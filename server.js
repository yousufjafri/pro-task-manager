require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const cloudant = CloudantV1.newInstance({
  authenticator: new IamAuthenticator({ apikey: process.env.CLOUDANT_APIKEY }),
  serviceUrl: process.env.CLOUDANT_URL,
});

const DB_NAME = 'tasks';

(async () => {
  try {
    const dbs = await cloudant.getAllDbs();
    if (!dbs.result.includes(DB_NAME)) {
      await cloudant.putDatabase({ db: DB_NAME });
      console.log(`✅ Database '${DB_NAME}' created.`);
    } else {
      console.log(`✅ Database '${DB_NAME}' exists.`);
    }

    // 🚀 Fetch all tasks
    app.get('/tasks', async (req, res) => {
      try {
        const docs = await cloudant.postAllDocs({ db: DB_NAME, includeDocs: true });
        const tasks = docs.result.rows.map(row => row.doc);
        res.json(tasks);
      } catch (err) {
        console.error('❌ Failed to fetch tasks:', err);
        res.status(500).send('Server error');
      }
    });

    // 📝 Add a task
    app.post('/tasks', async (req, res) => {
      try {
        const task = req.body;

        console.log("📩 New Task Received:", task);

        if (!task.text || typeof task.text !== 'string') {
          return res.status(400).send('Invalid task format');
        }

        await cloudant.postDocument({
          db: DB_NAME,
          document: {
            text: task.text,
            completed: task.completed === true // default false
          }
        });

        res.status(200).send('Task added');
      } catch (err) {
        console.error('❌ Failed to add task:', err);
        res.status(500).send('Server error');
      }
    });

    // 🧹 Delete a task
    app.delete('/tasks/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { rev } = req.query;
        await cloudant.deleteDocument({ db: DB_NAME, docId: id, rev });
        res.sendStatus(200);
      } catch (err) {
        console.error('❌ Failed to delete task:', err);
        res.status(500).send('Server error');
      }
    });

    // ✅ Mark task as completed or undo
    app.put('/tasks/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { rev, completed } = req.body;

        const existing = await cloudant.getDocument({ db: DB_NAME, docId: id });

        const updatedDoc = {
          ...existing.result,
          completed,
          _rev: rev
        };

        await cloudant.postDocument({ db: DB_NAME, document: updatedDoc });
        res.sendStatus(200);
      } catch (err) {
        console.error('❌ Failed to update task:', err);
        res.status(500).send('Server error');
      }
    });

    // 🚀 Start the server
    app.listen(3000, () => {
      console.log('🚀 Server running at http://localhost:3000');
    });

  } catch (err) {
    console.error('❌ Cloudant error:', err);
  }
})();
