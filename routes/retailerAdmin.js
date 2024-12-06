
const express = require('express');
const router = express.Router();
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../db');
const mw = require('../middleware/middlewareFunctions');
// Route for getting all purchases
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Directory to store files
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
  });
  
  // File filter for image validation
  const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|webp/;
    const mimeType = allowedFileTypes.test(file.mimetype);
    const extName = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  
    if (mimeType && extName) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG and PNG files are allowed.'));
    }
  };
  
  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5MB
  });
  
  router.get('/organisations',mw.retailerAuthentication,async(req, res) => {
   
    try{
        const userid = req.session.user.user_id;
        const userQuery = `SELECT DISTINCT u.user_id, u.name, u.email
                            FROM users u
                            JOIN food_claims o ON u.user_id = o.charity_id WHERE o.retailer_id=?`;
        const [uObj] = await db.promise().query(userQuery, [userid]);
        
        const data = { 
            title: 'Food Waste Reduction - Organisations', uData : uObj,pageTitle : 'Charity Organisations', smallTitle : 'Organisations who regularly claims our products'
          };
         console.log(req.cartData);
         res.render('retailer/list_customers', data);
  
    
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
  });
  router.get('/inventory-updates',mw.retailerAuthentication,async(req, res) => {
   
    try{
        const userid = req.session.user.user_id;
        const userQuery = `SELECT iu.*, u.name as updated_by,fi.name as item_name, fi.slug, fi.image  from inventory_updates iu 
        left join users u on u.user_id = iu.updated_by_user_id
        left join food_items fi on fi.item_id = iu.item_id
        WHERE fi.retailer_id = ? ORDER BY iu.inventory_update_id DESC`;
        const [iuObj] = await db.promise().query(userQuery, [userid]);
        const iUpdates = iuObj.map(item => ({
            id : item.inventory_update_id,
            change_quantity : item.change_quantity,
            update_timestamp : moment(item.update_timestamp).format('YYYY-MM-DD'),
            update_type: item.update_type,
            updated_by : item.updated_by,
            item_name : item.item_name,
            slug : item.slug,
            image : item.image
           
          }))
        const data = { 
            title: 'Food Waste Reduction - inventory', iUpdates : iUpdates
          };
         console.log(req.cartData);
         res.render('retailer/inventory', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
});
router.post('/dashboard-graph',mw.retailerAuthentication,async(req, res) => {
   
    try{
        const userId = req.session.user.user_id;
        let orderGrpData = [];
        const [orderGraphObj] = await db.promise().query(`SELECT SUM(grand_total) AS total_month_amount, MONTHNAME(CURDATE()) AS month_name FROM food_order WHERE retailer_id = ? AND DATE_FORMAT(purchase_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`, [userId]);
      if(orderGraphObj.length!==0)
        {
            orderGrpData = orderGraphObj.map(item => ({
              month : item.month_name,
              amount : item.total_month_amount,
              
            }))
        }
        return res.status(200).json({ message: orderGrpData});
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
});
router.get('/dashboard',mw.retailerAuthentication,async(req, res) => {
   
    try{
        let  food_items = orderGrpData = iUpdates = [];
      const userId = req.session.user.user_id;
      const oQuery = `SELECT count(*) as ordercount FROM food_order WHERE retailer_id = ?  AND DATE_FORMAT(purchase_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') `;
      const [ocObj] = await db.promise().query(oQuery, [userId]);
      const cQuery = ` SELECT count(*) as claimcount
  FROM food_claims
  WHERE retailer_id = ? 
  AND DATE_FORMAT(claim_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`;
      const [ccObj] = await db.promise().query(cQuery, [userId]);
      const pQuery = `SELECT count(*) as itemcount from food_claims WHERE  retailer_id = ? `;
      const [pcObj] = await db.promise().query(pQuery, [userId]);
      const userQuery = `SELECT iu.*, u.name as updated_by,fi.name as item_name, fi.slug, fi.image  from inventory_updates iu 
      left join users u on u.user_id = iu.updated_by_user_id
      left join food_items fi on fi.item_id = iu.item_id
      WHERE fi.retailer_id = ? AND DATE_FORMAT(update_timestamp, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') ORDER BY iu.inventory_update_id DESC `;
      const [iuObj] = await db.promise().query(userQuery, [userId]);
      const newProductQry = `SELECT fi.item_id, fi.name, fi.image, fi.quantity, fi.expiration_date, fi.price, fi.is_donated, fi.is_available_for_sale, u.name as retailer, DATEDIFF(expiration_date, NOW()) AS days_difference FROM food_items fi left join users u on u.user_id = fi.retailer_id WHERE fi.retailer_id=? AND DATE_FORMAT(fi.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')  `;
      const [newPdctObj] = await db.promise().query(newProductQry, [userId]);
      
        if(iuObj.length!==0)
        {
            iUpdates = iuObj.map(item => ({
                id : item.inventory_update_id,
                change_quantity : item.change_quantity,
                update_timestamp : moment(item.update_timestamp).format('YYYY-MM-DD'),
                update_type: item.update_type,
                updated_by : item.updated_by,
                item_name : item.item_name,
                slug : item.slug,
                image : item.image
            
            }))
        }
      if(newPdctObj.length!==0)
      {
         food_items = newPdctObj.map(item => ({
            id : item.item_id,
            name : item.name,
            quantity : item.quantity,
            expiry : moment(item.expiration_date).format('YYYY-MM-DD'),
            price: item.price,
            isDonated : item.is_donated,
            isSale : item.is_available_for_sale,
            retailer : item.retailer,
            days_difference : item.days_difference,
            image : item.image,
          }))
      }
      const data = { 
            title: 'Food Waste Reduction - Dashboard',
            ocData : ocObj[0].ordercount,
            ccData : ccObj[0].claimcount,
            fiData : pcObj[0].itemcount,
            currentMonth : moment().format('YYYY-MMMM'),
            iUpdates : iUpdates,
            newPdctData : food_items
           
          };
         console.log(req.cartData);
         res.render('retailer/dashboard', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
});
router.get('/profile', mw.retailerAuthentication,async(req, res) => {
   
    try{
        let serviceable = [];
        const userid = req.session.user.user_id;
        const userQuery = `SELECT * from users WHERE user_id = ?`;
        const [userObj] = await db.promise().query(userQuery, [userid]);
        const pcQuery = `SELECT * from postal_codes`;
        const [pcObj] = await db.promise().query(pcQuery);
        const spQuery = `SELECT * from servicable_pincode WHERE retailer_id = ?`;
        const [spObj] = await db.promise().query(spQuery, [userid]);
        if(spObj.length>0)
        {
             for(let i=0;i<spObj.length;i++)
             {
                serviceable.push(spObj[i].postalcode);
             }
        }
       console.log("serviceable",serviceable);
        if (!userObj || userObj.length === 0) 
            res.status(500).send('No data found123');
        else{
            userData = userObj[0];
            const data = { 
            title: 'Food Waste Reduction - profile' ,
            userData : userData,
            pcObj : pcObj,
            serviceable : serviceable
           
         };
        
         res.render('retailer/profile', data);
        }

    
    }
    catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
});
router.post('/edit_profile',upload.single('logo'),async (req, res) => {
    console.log(req.file);
    const {
     name,
    email,
     password,
      confirm_password,
      oldLogo,
      pincodes
     
  } = req.body;
  console.log("pincodes",pincodes);
  const imagePath = req.file ? req.file.filename : oldLogo;
  const errors = [];
  const userid = req.session.user.user_id;
  if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('Name is required and must be a string.');
  }
  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (
    !emailPattern.test(email)
) {
    errors.push(
        'Valid email required.'
    );
}
else{
    const userQuery = `SELECT * from users WHERE user_id != ? AND email like ?`;
    const [userObj] = await db.promise().query(userQuery, [userid, email]);
    console.log("userObj",userObj);
    if (userObj.length !== 0) 
    {
        errors.push(
            'Email already exists.'
        );
    }
    
}

  if (password != ''){
    if(typeof password !== 'string' ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)
) {
    errors.push(
        'Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.'
    );
}}

if (password != '' && !confirm_password) {
  errors.push('Confirm password missing.');
}
else if (password != '' && password !== confirm_password) {
    errors.push('Confirm password must match the password.');
}
if (pincodes == '') {
    errors.push('Serviceable postalcodes are missing.');
  }

  console.log(errors);
  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  try{
    const hashedPassword = await bcrypt.hash(password, 10);
    const postalCodesArray = pincodes.split(',').map(code => code.trim());
    let  sql, values;
    if (password != '')
    {
        sql = `UPDATE  users set name=? , email=? , password=? , logo =? WHERE  user_id=?`;
        values = [name, email, hashedPassword,imagePath, userid];
    }
    else
    {
        sql = `UPDATE  users set name=? , email=?, logo = ?  WHERE  user_id=?`;
        values = [name, email, imagePath, userid];
    }
   
  
  console.log(values);
  // Execute the query
  db.query(sql, values, (err, result) => {
      if (err) {
          console.error('Error inserting food item:', err);
          return res.status(500).json({ error: 'Edit profile failed. Try again!' });
      }
      const pincodeDetails = postalCodesArray.map(item => [
        userid,
        item
        ]);
      db.query(`DELETE  FROM servicable_pincode WHERE  retailer_id=?`, [userid], (err, result) => {
            if (err) {
                console.error('Error :', err.message);
            }
            db.query(`INSERT INTO servicable_pincode (retailer_id,postalcode) VALUES  ?`, [pincodeDetails], (err, result) => {
                if (err) {
                    console.error('Error :', err.message);
                    return res.status(500).json({ error: 'Edit profile failed. Try again!' });
                }
                res.status(201).json({
                    message: 'success',
                });
            });
           
        });
        
  });
}catch (error) {
  res.status(500).json({ error: 'Server error.'+ error.message });
}
  });
// Route for creating a new user
router.post('/', (req, res) => {
  const newUser = req.body; // Assuming you're sending JSON data
  res.send('User created');
});

module.exports = router;