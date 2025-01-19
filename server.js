const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create Express App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB URI
const MONGO_URI = "mongodb+srv://jotterboss:6kvEs93Rv3hMMMZP@cluster0.ealoq1g.mongodb.net/jotter?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer Storage for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Define Mongoose Schemas
const noteSchema = new mongoose.Schema({
  header: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  favourite: { type: Boolean, default: false },
  type: { type: String, default: 'general' },
});

const pdfSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const imageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

// Create Models
const Note = mongoose.model('Note', noteSchema);
const Pdf = mongoose.model('Pdf', pdfSchema);
const Image = mongoose.model('Image', imageSchema);

// API Routes
app.get('/', (req, res) => {
  res.send('🚀 Server is running successfully!');
});

// Notes API
app.post('/notes', async (req, res) => {
  try {
    const newNote = new Note(req.body);
    await newNote.save();
    res.status(201).json(newNote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/notes', async (req, res) => {
  try {
    const { date } = req.query;
    const query = date
      ? {
          createdAt: {
            $gte: new Date(`${date}T00:00:00.000Z`),
            $lt: new Date(`${date}T23:59:59.999Z`),
          },
        }
      : {};
    const notes = await Note.find(query);
    res.status(200).json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Upload & Fetch
app.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    const { originalname, filename } = req.file;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    const newPdf = new Pdf({ name: originalname, url: fileUrl });
    await newPdf.save();
    res.status(201).json(newPdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/pdfs', async (req, res) => {
  try {
    const pdfs = await Pdf.find();
    res.status(200).json(pdfs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image Upload & Fetch
app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const { originalname, filename } = req.file;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    const newImage = new Image({ name: originalname, url: fileUrl });
    await newImage.save();
    res.status(201).json(newImage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/images', async (req, res) => {
  try {
    const images = await Image.find();
    res.status(200).json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats Endpoints
app.get('/notes-stats', async (req, res) => {
  try {
    const notesCount = await Note.countDocuments();
    const notesSize = await Note.aggregate([
      {
        $project: {
          size: {
            $add: [
              { $strLenBytes: "$header" },
              { $strLenBytes: "$description" }
            ]
          }
        }
      },
      { $group: { _id: null, totalSize: { $sum: "$size" } } },
    ]);
    const totalSize = notesSize.length > 0 ? notesSize[0].totalSize : 0;

    res.status(200).json({
      count: notesCount,
      totalSize: `${(totalSize / 1024).toFixed(2)} MB`, // ensure size is formatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/images-stats', async (req, res) => {
  try {
    const imagesCount = await Image.countDocuments();
    const imagesSize = fs.readdirSync(uploadDir)
      .filter(file => file.match(/\.(jpg|jpeg|png|gif)$/))
      .map(file => fs.statSync(path.join(uploadDir, file)).size)
      .reduce((acc, size) => acc + size, 0);

    res.status(200).json({
      count: imagesCount,
      totalSize: `${(imagesSize / 1024).toFixed(2)} MB`, // ensure size is formatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/pdf-stats', async (req, res) => {
  try {
    const pdfCount = await Pdf.countDocuments();
    const pdfSize = fs.readdirSync(uploadDir)
      .filter(file => file.match(/\.pdf$/))
      .map(file => fs.statSync(path.join(uploadDir, file)).size)
      .reduce((acc, size) => acc + size, 0);

    res.status(200).json({
      count: pdfCount,
      totalSize: `${(pdfSize / 1024).toFixed(2)} MB`, // ensure size is formatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/database-size', async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const totalSize = stats.dataSize || 0;

    res.status(200).json({
      totalSize: `${(totalSize / 1024).toFixed(2)} MB`, // ensure size is formatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
