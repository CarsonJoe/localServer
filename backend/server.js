// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Initialize database
const db = new sqlite3.Database('research.db');

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER,
      content_type TEXT NOT NULL, -- 'text', 'image'
      content_text TEXT,
      image_path TEXT,
      description TEXT,
      manual_description BOOLEAN DEFAULT FALSE,
      organization TEXT,
      source_type TEXT, -- 'primary', 'secondary', 'tertiary'
      people TEXT, -- JSON array as string
      content_category TEXT, -- 'chart', 'research', 'interview', etc.
      industry TEXT,
      content_date TEXT,
      embedding TEXT, -- JSON array as string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources (id)
    )
  `);
});

// Helper function to generate embeddings
async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Helper function to analyze content with Gemini
async function analyzeContent(contentText, imageBuffer = null) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
      }
    });

    let prompt = `Analyze this content and provide:
1. A brief description focusing on insights and significance (2-3 sentences max)
2. Extract these tags as JSON:
   - organization: string (institution/company mentioned)
   - source_type: "primary" | "secondary" | "tertiary"
   - people: array of names mentioned
   - content_category: "chart" | "research" | "interview" | "opinion" | "data" | "analysis" | "other"
   - industry: string (main industry/domain)
   - content_date: string (date of content if mentioned, null if not)

Focus on second-order meaning - what does this tell us? Why is it significant? What are the implications?

Format response as:
DESCRIPTION: [your description]
TAGS: [JSON object]

Content: ${contentText}`;

    let parts = [prompt];
    
    if (imageBuffer) {
      parts.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    
    // Parse the response
    const descMatch = response.match(/DESCRIPTION: (.*?)(?=TAGS:|$)/s);
    const tagsMatch = response.match(/TAGS: (.*)/s);
    
    const description = descMatch ? descMatch[1].trim() : '';
    let tags = {};
    
    if (tagsMatch) {
      try {
        tags = JSON.parse(tagsMatch[1].trim());
      } catch (e) {
        console.error('Error parsing tags:', e);
      }
    }

    return { description, tags };
  } catch (error) {
    console.error('Error analyzing content:', error);
    return { description: '', tags: {} };
  }
}

// Helper function for cosine similarity
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Routes

// Get all sources
app.get('/api/sources', (req, res) => {
  db.all('SELECT * FROM sources ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new source
app.post('/api/sources', (req, res) => {
  const { title, url } = req.body;
  
  db.run('INSERT INTO sources (title, url) VALUES (?, ?)', [title, url], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, title, url });
  });
});

// Add content to source
app.post('/api/content', upload.single('image'), async (req, res) => {
  try {
    const { 
      source_id, 
      content_text, 
      manual_description, 
      description: providedDescription 
    } = req.body;
    
    let content_type = 'text';
    let image_path = null;
    let analysisText = content_text || '';
    let imageBuffer = null;

    // Handle image upload
    if (req.file) {
      content_type = 'image';
      image_path = req.file.filename;
      imageBuffer = fs.readFileSync(req.file.path);
    }

    // Analyze content with AI if no manual description provided
    let description = providedDescription || '';
    let tags = {};
    
    if (!manual_description || !providedDescription) {
      const analysis = await analyzeContent(analysisText, imageBuffer);
      description = analysis.description;
      tags = analysis.tags;
    }

    // Generate embedding for the description
    const embedding = await generateEmbedding(description);

    // Insert into database
    db.run(`
      INSERT INTO content (
        source_id, content_type, content_text, image_path, description, 
        manual_description, organization, source_type, people, content_category, 
        industry, content_date, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      source_id,
      content_type,
      content_text,
      image_path,
      description,
      manual_description === 'true',
      tags.organization || null,
      tags.source_type || null,
      JSON.stringify(tags.people || []),
      tags.content_category || null,
      tags.industry || null,
      tags.content_date || null,
      JSON.stringify(embedding || [])
    ], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        id: this.lastID,
        source_id,
        content_type,
        description,
        tags
      });
    });

  } catch (error) {
    console.error('Error processing content:', error);
    res.status(500).json({ error: 'Failed to process content' });
  }
});

// Search content
app.post('/api/search', async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      res.status(500).json({ error: 'Failed to generate search embedding' });
      return;
    }

    // Build SQL query with filters
    let sqlQuery = `
      SELECT c.*, s.title as source_title, s.url as source_url 
      FROM content c 
      JOIN sources s ON c.source_id = s.id 
      WHERE 1=1
    `;
    const params = [];

    if (filters.content_type) {
      sqlQuery += ' AND c.content_type = ?';
      params.push(filters.content_type);
    }
    if (filters.organization) {
      sqlQuery += ' AND c.organization LIKE ?';
      params.push(`%${filters.organization}%`);
    }
    if (filters.source_type) {
      sqlQuery += ' AND c.source_type = ?';
      params.push(filters.source_type);
    }
    if (filters.content_category) {
      sqlQuery += ' AND c.content_category = ?';
      params.push(filters.content_category);
    }
    if (filters.industry) {
      sqlQuery += ' AND c.industry LIKE ?';
      params.push(`%${filters.industry}%`);
    }

    sqlQuery += ' ORDER BY c.created_at DESC';

    db.all(sqlQuery, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Calculate similarity scores and sort by relevance
      const resultsWithScores = rows.map(row => {
        let similarity = 0;
        if (row.embedding) {
          try {
            const contentEmbedding = JSON.parse(row.embedding);
            similarity = cosineSimilarity(queryEmbedding, contentEmbedding);
          } catch (e) {
            similarity = 0;
          }
        }
        
        return {
          ...row,
          people: JSON.parse(row.people || '[]'),
          similarity_score: similarity
        };
      });

      // Sort by similarity score
      resultsWithScores.sort((a, b) => b.similarity_score - a.similarity_score);

      res.json(resultsWithScores);
    });

  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all content
app.get('/api/content', (req, res) => {
  db.all(`
    SELECT c.*, s.title as source_title, s.url as source_url 
    FROM content c 
    JOIN sources s ON c.source_id = s.id 
    ORDER BY c.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const formattedRows = rows.map(row => ({
      ...row,
      people: JSON.parse(row.people || '[]')
    }));
    
    res.json(formattedRows);
  });
});

// Get unique filter values for dropdown menus
app.get('/api/filters', (req, res) => {
  const queries = {
    organizations: 'SELECT DISTINCT organization FROM content WHERE organization IS NOT NULL',
    source_types: 'SELECT DISTINCT source_type FROM content WHERE source_type IS NOT NULL',
    content_categories: 'SELECT DISTINCT content_category FROM content WHERE content_category IS NOT NULL',
    industries: 'SELECT DISTINCT industry FROM content WHERE industry IS NOT NULL'
  };

  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, rows) => {
      if (!err) {
        results[key] = rows.map(row => Object.values(row)[0]).filter(Boolean);
      }
      completed++;
      
      if (completed === total) {
        res.json(results);
      }
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running`);
});
