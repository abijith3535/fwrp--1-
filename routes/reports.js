
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../db');
const mw = require('../middleware/middlewareFunctions');
// Route for getting all purchases
router.get('/purchases', mw.retailerAuthentication,(req, res) => {
    const data = { title: 'Food Waste Reduction - purchases' };
    res.render('retailer/report_purchases', data); 
    
  });
router.get('/claims', mw.retailerAuthentication,(req, res) => {
    const data = { title: 'Food Waste Reduction - claim' };
    res.render('retailer/report_claim', data); 
    
});
router.post('/generate-report-purchases', (req, res) => {
    try {
      const { from, to } = req.body;
      const errors = [];
  
      let sql = '';
      let values = [];
      const retailerId = req.session.user.user_id;
  
      // Validate Dates
      if (from && to && to < from) {
        errors.push('From date should not exceed To date.');
      }
  
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
  
      // Build SQL Query
      if (!from && to) {
        // Only `to` date provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) <= ?
          ORDER BY fd.purchase_date DESC
        `;
        values = [retailerId, to];
      } else if (from && !to) {
        // Only `from` date provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) >= ?
          ORDER BY fd.purchase_date DESC
        `;
        values = [retailerId, from];
      } else {
        // Both `from` and `to` dates provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) BETWEEN ? AND ?
          ORDER BY fd.purchase_date DESC
        `;
        values = [retailerId, from, to];
      }
  
      // Execute Query
      db.query(sql, values, (err, results) => {
        if (err) {
          console.error('Error fetching report:', err.message);
          return res.status(500).json({ message: 'Database error.', error: err.message });
        }
  
        if (results.length === 0) {
          return res.status(404).json({ message: 'No records found for the given criteria.' });
        }
  
        // Format and Send Response
        const report = results.map((item) => ({
          order_id: item.order_id,
          order_unique: item.order_unique,
          name: item.name,
          consumer_id: item.consumer_id,
          address_id: item.address_id,
          total_price: item.total_price,
          delivery_charge: item.delivery_charge,
          grand_total: item.grand_total,
          status: item.status,
          purchase_date: moment(item.purchase_date).format('YYYY-MM-DD'),
        }));
  
        res.status(200).json({
          message: 'success',
          report,
        });
      });
    } catch (error) {
      console.error('Server error:', error.message);
      res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
  });
  router.post('/generate-report-claims', (req, res) => {
    try {
      const { from, to } = req.body;
      const errors = [];
  console.log("from",from);
  console.log("to",to);
      let sql = '';
      let values = [];
      const retailerId = req.session.user.user_id;
  
      // Validate Dates
      if (from && to && to < from) {
        errors.push('From date should not exceed To date.');
      }
  
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
  
      // Build SQL Query
      if (!from && to) {
        // Only `to` date provided
        sql = `
        SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.image 
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.retailer_id  = ?
        AND DATE(fc.claim_date) <= ? 
        ORDER BY fc.claim_date   DESC 
        `;
        values = [retailerId, to];
      } else if (from && !to) {
        // Only `from` date provided
        sql = `
        SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.image 
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.retailer_id  = ?
        AND DATE(fc.claim_date) >= ?
        ORDER BY fc.claim_date   DESC 
    `;
        values = [retailerId, from];
      } else {
        // Both `from` and `to` dates provided
        sql = `
        SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.image 
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.retailer_id  = ?
         AND DATE(fc.claim_date) BETWEEN ? AND ?
        ORDER BY fc.claim_date   DESC 
        `;
        values = [retailerId, from, to];
      }
  console.log(sql);
      // Execute Query
      db.query(sql, values, (err, results) => {
        if (err) {
          console.error('Error fetching report:', err.message);
          return res.status(500).json({ message: 'Database error.', error: err.message });
        }
  
        if (results.length === 0) {
          return res.status(404).json({ message: 'No records found for the given criteria.' });
        }
        
        // Format and Send Response
        const report = results.map((item) => ({
          claim_id: item.claim_id,
          consumer: item.consumer,
          name: item.name,
          quantity: item.quantity,
          status: item.status,
          claim_date: moment(item.claim_date).format('YYYY-MM-DD'),
        }));
  
        res.status(200).json({
          message: 'success',
          report,
        });
      });
    } catch (error) {
      console.error('Server error:', error.message);
      res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
  });
module.exports = router;