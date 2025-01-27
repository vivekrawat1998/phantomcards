const app = require('./app');
const port = process.env.PORT || 3000;

// Only run the server when not on Vercel
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
