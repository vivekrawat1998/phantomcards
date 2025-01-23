const app = require('./app');

// Remove the http server creation
// const server = http.createServer(app);

// Export the app directly for Vercel
module.exports = app;

// Only listen if running directly (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}