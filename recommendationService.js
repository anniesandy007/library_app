const ort = require('onnxruntime-node');
const similarity = require('cosine-similarity');
const SampleCollectionBook = require('./model/SampleCollectionBook');

class RecommendationService {
    constructor() {
        this.tokenizer = null;
        this.session = null;
        this.bookEmbeddings = new Map();
        this.books = [];
    }

    // 1. Initialize the model and pre-compute book embeddings
    async init() {
        console.log('Initializing Recommendation Service...');
        const { AutoTokenizer } = await import('@xenova/transformers');
        // Load tokenizer and ONNX session
        this.tokenizer = await AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2');
        this.session = await ort.InferenceSession.create('./model.onnx'); // <--- Update this line if your model is in a 'models' folder
        console.log('Tokenizer and ONNX model loaded.');

        // Fetch books from the database
        try {
            this.books = await SampleCollectionBook.find({});
        } catch (error) {
            console.error("Error fetching books:", error);
            this.books = []; // Ensure books is an empty array to prevent further errors
        }
        console.log(`Found ${this.books.length} books to process.`);

        // Pre-compute embeddings for all books
        for (const book of this.books) {
            // Combine title and authors for a richer embedding
            const textToEmbed = `${book.title || ''} by ${book.authors || ''}`;
            const embedding = await this.generateEmbedding(textToEmbed);
            this.bookEmbeddings.set(book.bookID.toString(), embedding);
        }
        console.log(`Pre-computed embeddings for ${this.bookEmbeddings.size} books.`);
    }

    // 2. Generate an embedding for a given text
    async generateEmbedding(text) {
        // Tokenize the text
        const encoded = await this.tokenizer(text, { padding: true, truncation: true });
    
        if (!encoded || !encoded.input_ids || !encoded.input_ids.data) {
            console.error("Error: encoded data is not valid:", encoded);
            return null; // Or throw an error, depending on your error handling strategy
        }
    
        // Prepare the input tensors for the ONNX model
    const inputIds = BigInt64Array.from(encoded.input_ids.data.map(BigInt));
        const attentionMask = BigInt64Array.from(encoded.attention_mask.data.map(BigInt));
        const tokenTypeIds = BigInt64Array.from(encoded.token_type_ids.data.map(BigInt));

        const inputIdsTensor = new ort.Tensor('int64', inputIds, [1, encoded.input_ids.dims[1]]);
        const attentionMaskTensor = new ort.Tensor('int64', attentionMask, [1, encoded.attention_mask.dims[1]]);
        const tokenTypeIdsTensor = new ort.Tensor('int64', tokenTypeIds, [1, encoded.token_type_ids.dims[1]]);

        let output;
        try {
            // Run the model
            output = await this.session.run({
                input_ids: inputIdsTensor,
                attention_mask: attentionMaskTensor,
                token_type_ids: tokenTypeIdsTensor,
            });
        } catch (e) {
            console.error("Error running ONNX model for text:", text, "Error details:", e);
            return null;
        }

        // Check if the model output is valid
        if (!output || !output.sentence_embedding) {
            console.error("Error: ONNX model output is not valid for text:", text, "Output object:", output);
            return null; // Or handle this case appropriately
        }

        // The model provides the sentence embedding directly.
        // Convert the Float32Array to a regular array.
        const embedding = Array.from(output.sentence_embedding.data);
        return embedding; 
    }

    // 3. Get recommendations for a user prompt
    async getRecommendations(prompt) {
        if (this.bookEmbeddings.size === 0) {
            console.log('Embeddings not ready.');
            return [];
        }

        // Generate embedding for the user's prompt
        const promptEmbedding = await this.generateEmbedding(prompt);

        // Calculate similarity scores
        const booksWithScores = this.books.map(book => {
            const bookEmbedding = this.bookEmbeddings.get(book.bookID.toString());
            const score = similarity(promptEmbedding, bookEmbedding);
            return { ...book.toObject(), score };
        });

        // Sort by score and return the top 9
        return booksWithScores.sort((a, b) => b.score - a.score).slice(0, 9);
    }
}

module.exports = new RecommendationService();