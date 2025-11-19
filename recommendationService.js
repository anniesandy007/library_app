// const ort = require('onnxruntime-node');
// const similarity = require('cosine-similarity');
// const SampleCollectionBook = require('./model/SampleCollectionBook');

// class RecommendationService {
//     constructor() {
//         this.tokenizer = null;
//         this.session = null;
//         this.bookEmbeddings = new Map();
//         this.books = [];
//     }

//     // 1. Initialize the model and pre-compute book embeddings
//     async init() {
//         console.log('Initializing Recommendation Service...');
//         const { AutoTokenizer } = await import('@xenova/transformers');
//         // Load tokenizer and ONNX session
//         this.tokenizer = await AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2');
//         // Explicitly specify the CPU execution provider
//         const sessionOptions = { executionProviders: ['cpu'] };
//         this.session = await ort.InferenceSession.create('./model.onnx', sessionOptions);
//         console.log('Tokenizer and ONNX model loaded.');

//         // Fetch books from the database
//         try {
//             this.books = await SampleCollectionBook.find({});
//         } catch (error) {
//             console.error("Error fetching books:", error);
//             this.books = []; // Ensure books is an empty array to prevent further errors
//         }
//         console.log(`Found ${this.books.length} books to process.`);

//         // Pre-compute embeddings for all books
//         for (const book of this.books) {
//             // Combine title and authors for a richer embedding
//             const textToEmbed = `${book.title || ''} by ${book.authors || ''}`;
//             const embedding = await this.generateEmbedding(textToEmbed);
//             this.bookEmbeddings.set(book.bookID.toString(), embedding);
//         }
//         console.log(`Pre-computed embeddings for ${this.bookEmbeddings.size} books.`);
//     }

//     // 2. Generate an embedding for a given text
//     async generateEmbedding(text) {
//         // Tokenize the text
//         const encoded = await this.tokenizer(text, { padding: true, truncation: true });
    
//         if (!encoded || !encoded.input_ids || !encoded.input_ids.data) {
//             console.error("Error: encoded data is not valid:", encoded);
//             return null; // Or throw an error, depending on your error handling strategy
//         }
    
//         // Prepare the input tensors for the ONNX model
//     const inputIds = BigInt64Array.from(encoded.input_ids.data.map(BigInt));
//         const attentionMask = BigInt64Array.from(encoded.attention_mask.data.map(BigInt));
//         const tokenTypeIds = BigInt64Array.from(encoded.token_type_ids.data.map(BigInt));

//         const inputIdsTensor = new ort.Tensor('int64', inputIds, [1, encoded.input_ids.dims[1]]);
//         const attentionMaskTensor = new ort.Tensor('int64', attentionMask, [1, encoded.attention_mask.dims[1]]);
//         const tokenTypeIdsTensor = new ort.Tensor('int64', tokenTypeIds, [1, encoded.token_type_ids.dims[1]]);

//         let output;
//         try {
//             // Run the model
//             output = await this.session.run({
//                 input_ids: inputIdsTensor,
//                 attention_mask: attentionMaskTensor,
//                 token_type_ids: tokenTypeIdsTensor,
//             });
//         } catch (e) {
//             console.error("Error running ONNX model for text:", text, "Error details:", e);
//             return null;
//         }

//         // Check if the model output is valid
//         if (!output || !output.sentence_embedding) {
//             console.error("Error: ONNX model output is not valid for text:", text, "Output object:", output);
//             return null; // Or handle this case appropriately
//         }

//         // The model provides the sentence embedding directly.
//         // Convert the Float32Array to a regular array.
//         const embedding = Array.from(output.sentence_embedding.data);
//         return embedding; 
//     }

//     // 3. Get recommendations for a user prompt
//     async getRecommendations(prompt) {
//         if (this.bookEmbeddings.size === 0) {
//             console.log('Embeddings not ready.');
//             return [];
//         }

//         // Generate embedding for the user's prompt
//         const promptEmbedding = await this.generateEmbedding(prompt);

//         // Calculate similarity scores
//         const booksWithScores = this.books.map(book => {
//             const bookEmbedding = this.bookEmbeddings.get(book.bookID.toString());
//             const score = similarity(promptEmbedding, bookEmbedding);
//             return { ...book.toObject(), score };
//         });

//         // Sort by score and return the top 9
//         return booksWithScores.sort((a, b) => b.score - a.score).slice(0, 9);
//     }
// }

// module.exports = new RecommendationService();

// We only need the transformers library now.
const SampleCollectionBook = require('./model/SampleCollectionBook'); 

class RecommendationService {
    constructor() {
        this.embeddingPipeline = null;
        this.bookEmbeddings = new Map();
        this.books = [];
    }

    // 1. Initialize the pipeline and pre-compute book embeddings
    async init() {
        console.log('Initializing Recommendation Service...');
        const { pipeline } = await import('@xenova/transformers');
        
        // Use the sentence-transformers pipeline from Xenova/transformers.
        // This handles both tokenizer and model session using WebAssembly/WebGPU, 
        // avoiding native C++ issues.
        this.embeddingPipeline = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2' 
        );
        console.log('Embedding pipeline loaded successfully.');

        // Fetch books from the database
        try {
            this.books = await SampleCollectionBook.find({}).lean(); // Use .lean() for faster, plain JavaScript objects
        } catch (error) {
            console.error("Error fetching books:", error);
            this.books = []; 
        }
        console.log(`Found ${this.books.length} books to process.`);

        // Pre-compute embeddings for all books in batches for performance
        const batchSize = 64;
        for (let i = 0; i < this.books.length; i += batchSize) {
            const batch = this.books.slice(i, i + batchSize);
            const textsToEmbed = batch.map(book => `${book.title || ''} by ${book.authors || ''}`);
            
            // Generate embeddings for the batch
            const embeddings = await this.embeddingPipeline(textsToEmbed, { pooling: 'mean', normalize: true });
            
            // Store embeddings
            for (let j = 0; j < batch.length; j++) {
                // Convert the Tensor to a Float32Array for storage
                const embeddingArray = embeddings[j].data; 
                this.bookEmbeddings.set(batch[j].bookID.toString(), embeddingArray);
            }
        }
        
        console.log(`Pre-computed embeddings for ${this.bookEmbeddings.size} books.`);
    }

    /**
     * Generates a normalized embedding vector for the given text.
     * @param {string} text - The input text.
     * @returns {Float32Array} The embedding vector.
     */
    async generateEmbedding(text) {
        if (!this.embeddingPipeline) {
            throw new Error("Embedding pipeline is not initialized.");
        }
        // Generate embedding using the pipeline, requesting mean pooling and normalization
        const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
        
        // output is a Tensor, we return its underlying data buffer (Float32Array)
        return output.data;
    }

    // 3. Get recommendations for a user prompt
    async getRecommendations(prompt) {
        if (this.bookEmbeddings.size === 0) {
            console.log('Embeddings not ready or catalog is empty.');
            return [];
        }

        // Generate embedding for the user's prompt
        const promptEmbedding = await this.generateEmbedding(prompt);
        
        // Convert prompt embedding to a TensorFlow/Xenova Tensor for easy similarity calculation
        const promptTensor = [promptEmbedding]; 

        // Calculate similarity scores
        const booksWithScores = [];
        for (const book of this.books) {
            const bookEmbedding = this.bookEmbeddings.get(book.bookID.toString());
            
            if (bookEmbedding) {
                // cos_sim calculates cosine similarity between two tensors (arrays)
                // Note: The original library's cos_sim is simpler, but this is the optimized way with Xenova.
                // We'll calculate similarity manually since the Xenova function is tensor-based.
                
                // Simple dot product (since both are already normalized) is equal to cosine similarity
                let score = 0;
                for (let k = 0; k < promptEmbedding.length; k++) {
                    score += promptEmbedding[k] * bookEmbedding[k];
                }

                booksWithScores.push({ ...book, score });
            }
        }

        // Sort by score and return the top 9
        return booksWithScores.sort((a, b) => b.score - a.score).slice(0, 9);
    }
}

module.exports = new RecommendationService();
