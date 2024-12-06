const mysql = require('mysql2');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'food_waste_reduction',
    connectionLimit: 10, // Recommended for production
});

module.exports = pool;