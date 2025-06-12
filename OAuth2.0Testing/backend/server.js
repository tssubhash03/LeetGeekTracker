const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const CLIENT_ID = 'Ov23li5yyflTNfRcNjhc';
const CLIENT_SECRET = '07d8ba35d40a0529bb120a6364d6b2b8e9d3355e';

app.post('/exchange-code', async (req, res) => {
  const { code } = req.body;
  console.log(code);

  try {
    const response = await axios.post(
      `https://github.com/login/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    console.log(response.data);
    res.json(response.data); // { access_token: "...", token_type: "bearer" }
  } catch (err) {
    res.status(500).json({ error: 'Failed to exchange code' });
  }
});

app.listen(PORT, () => console.log(`OAuth server running on http://localhost:${PORT}`));
