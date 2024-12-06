
const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const moment = require('moment');
const path = require('path');
const mysql = require('mysql2');
const mw = require('../middleware/middlewareFunctions');
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
// Route for getting all items
router.get('/', mw.retailerAuthentication,(req, res) => {
  const query = 'SELECT fi.item_id, fi.name, fi.image, fi.quantity, fi.expiration_date, fi.price, fi.is_donated, fi.is_available_for_sale, u.name as retailer, DATEDIFF(expiration_date, NOW()) AS days_difference FROM food_items fi left join users u on u.user_id = fi.retailer_id WHERE fi.retailer_id=?';
  db.query(query,[req.session.user.user_id],(err, results)=>
  {
    if(err)
    {
      return res.status(500).send('Something went wrong!');
    }
    const food_items = results.map(item => ({
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
   
    const data = { title: 'Food Waste Reduction - food items' ,food_items : food_items};
   res.render('retailer/list_items', data);  
  });
  
});
router.get('/surplus', mw.retailerAuthentication,(req, res) => {
    const query = 'SELECT fi.item_id, fi.name,  fi.image,fi.quantity, fi.expiration_date, fi.price, fi.is_donated, fi.is_available_for_sale, u.name as retailer, DATEDIFF(expiration_date, NOW()) AS days_difference FROM food_items fi left join users u on u.user_id = fi.retailer_id WHERE fi.is_donated = true ORDER BY fi.item_id desc';
    db.query(query,(err, results)=>
    {
      if(err)
      {
        return res.status(500).send('Something went wrong!');
      }
      const food_items = results.map(item => ({
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
      const data = { title: 'Food Waste Reduction - food items' ,food_items : food_items};
     res.render('retailer/list_items', data);  
    });
    
  });
// Route for adding an item
router.get('/add',mw.retailerAuthentication, (req, res) => {
  const data = { title: 'Food Waste Reduction - Add food item' };
  res.render('retailer/add_item', data);  
});

router.get('/edit/:id', mw.retailerAuthentication,(req, res) => {
    const id = req.params.id;
    const query = `SELECT *, DATEDIFF(expiration_date, NOW()) AS days_difference FROM food_items WHERE item_id= ?`;
  db.query(query,[id],(err, results)=>
  {
    if(err)
    {
      return res.status(500).send('Something went wrong!');
    }
    const itemdata =  {
        item_id : results[0].item_id,
        retailer_id :results[0].retailer_id,
        slug:results[0].slug,
        name:results[0].name,
        description :results[0].description,
        quantity :results[0].quantity,
        expiration_date :  moment(results[0].expiration_date).format('YYYY-MM-DD'),
        price :results[0].price,
        actual_price :results[0].actual_price,
        is_donated :results[0].is_donated,
        is_available_for_sale :results[0].is_available_for_sale,
        image :results[0].image,
        days_difference : results[0].days_difference,
    }
    const data = { title: 'Food Waste Reduction - food items' ,fdata : itemdata};
    res.render('retailer/edit_item', data);  
  });
  });
// Route for getting a single item
router.get('/:id', mw.retailerAuthentication,(req, res) => {
  const userId = req.params.id;
  res.send(`User with ID: ${userId}`);
});
router.post('/submit_edit_items', upload.single('image'),async (req, res) => {
    const {
      item_id,
      retailer_id,
      slug,
      name,
      description,
      quantity,
      expiration_date,
      price,
      actual_price,
      is_donated,
      is_available_for_sale,
      old_image,
      send_noti
  } = req.body;

  const imagePath = req.file ? req.file.filename : old_image;
console.log("is_available_for_sale",is_available_for_sale);
  
  const errors = [];
  let isDonated = Array.isArray(is_donated) 
  ? is_donated.includes('true') || is_donated.includes('on') 
  : is_donated === 'true' || is_donated === 'on';

  let isAvailableForSale = Array.isArray(is_available_for_sale) 
  ? is_available_for_sale.includes('true') || is_available_for_sale.includes('on') 
  : is_available_for_sale === 'true' || is_available_for_sale === 'on';
  // Validate input
 
  let sendNoti = Array.isArray(send_noti) 
  ? send_noti.includes('true') || send_noti.includes('on') 
  : send_noti === 'true' || send_noti === 'on';
  // Validate input
  if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('Name is required and must be a string.');
  }
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      errors.push('Slug is required and must be a string without special characters.');
  }
  else
  {
    const iQuery = `SELECT * from food_items WHERE item_id NOT IN (?) AND slug like ?`;
    const [itemO] = await db.promise().query(iQuery, [item_id, slug]);
    if (itemO.length !== 0) 
    {
        errors.push(
            'Slug already exists.'
        );
    }
    
}
  if (!description || description && typeof description !== 'string') {
      errors.push('Description must be a string.');
  }
  if (!quantity || quantity < 0) {
      errors.push('Quantity must be a non-negative integer.');
  }
  if (!expiration_date) {
      errors.push('Expiration date is required and must be a valid date.');
  } else if (new Date(expiration_date) < new Date()) {
      errors.push('Expiration date cannot be in the past.');
  }
  if (!price || price === undefined || isNaN(price) || price < 0) {
      errors.push('Price must be a non-negative number.');
  }
  if (!actual_price || actual_price === undefined || isNaN(actual_price) || actual_price < 0) {
    errors.push('Actual price must be a non-negative number.');
}
  if (typeof isDonated !== 'boolean') {
      errors.push('is_donated must be a boolean value.');
  }
  if (typeof isAvailableForSale !== 'boolean') {
      errors.push('is_available_for_sale must be a boolean value.');
  }

  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  
  // Insert query
  const sql = `
      UPDATE food_items 
      SET retailer_id=?, name=?, slug=?,description=?, quantity=?, expiration_date=?, actual_price=?,  price=?, image=?, is_donated=?, is_available_for_sale=?
      WHERE item_id = ?
  `;
  const values = [
      retailer_id,
      name,
      slug,
      description.trim(),
      parseInt(quantity),
      expiration_date,
      actual_price,
      price,
      imagePath,
      isDonated,
      isAvailableForSale,
      item_id
  ];
console.log(values);

  db.query(sql, values, (err, result) => {
    const formattedQuery = mysql.format(sql, values);
    
      if (err) {
          console.error('Error in updating food item:', err);
          return res.status(500).json({ error: 'Database error while updating food item.' +err.message });
      }
      if(sendNoti)
        {
            console.log("is avilable");
            req.productData = {
                id : item_id,
                name : name,
                slug:slug,
                expiry : moment(expiration_date).format('YYYY-MM-DD'),
                retailer : req.session.user.name,
                description : description.trim(),
                actual_price : actual_price,
                price : price,
                stock : parseInt(quantity)>1
            };
           
            mw.notifyUsers(req, res, () => {
                const siteName = req.app.locals.siteName;
                res.status(201).json({
                    message: 'Food item updated successfully.',
                    url : `${siteName}/retailer/fooditems`
                });
            });
        }
        else{
                const siteName = req.app.locals.siteName;
                res.status(201).json({
                    message: 'Food item updated successfully.',
                    url : `${siteName}/retailer/fooditems`
                });
        }
  });
  });
  
router.post('/submit_items', upload.single('image'),async (req, res) => {
 

try{
    const {
        
        slug,
        name,
        description,
        quantity,
        expiration_date,
        actual_price,
        price,
        is_donated,
        is_available_for_sale,
        send_noti
    } = req.body;
const imagePath = req.file ? req.file.filename : '';
// Initialize an array to collect errors
const errors = [];
let isDonated = Array.isArray(is_donated) 
  ? is_donated.includes('true') || is_donated.includes('on') 
  : is_donated === 'true' || is_donated === 'on';
let sendNoti = Array.isArray(send_noti) 
    ? send_noti.includes('true') || send_noti.includes('on') 
    : send_noti === 'true' || send_noti === 'on';
let isAvailableForSale = Array.isArray(is_available_for_sale) 
    ? is_available_for_sale.includes('true') || is_available_for_sale.includes('on') 
    : is_available_for_sale === 'true' || is_available_for_sale === 'on';
// Validate input

if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required and must be a string.');
}
if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    errors.push('Slug is required and must be a string without special characters.');
}
if (!description || description && typeof description !== 'string') {
    errors.push('Description must be a string.');
}
if (!quantity || quantity < 0) {
    errors.push('Quantity must be a non-negative integer.');
}
if (!expiration_date) {
    errors.push('Expiration date is required and must be a valid date.');
} else if (new Date(expiration_date) < new Date()) {
    errors.push('Expiration date cannot be in the past.');
}
if (!actual_price || actual_price === undefined || isNaN(actual_price) || actual_price < 0) {
    errors.push('Actual price must be a non-negative number.');
}
if (!price || price === undefined || isNaN(price) || price < 0) {
    errors.push('Price must be a non-negative number.');
}
if (typeof isDonated !== 'boolean') {
    errors.push('is_donated must be a boolean value.');
}
if (typeof isAvailableForSale !== 'boolean') {
    errors.push('is_available_for_sale must be a boolean value.');
}
if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') {
    errors.push('Image is required.');
}

console.log(errors);
// If there are errors, return them in the response
if (errors.length > 0) {
    return res.status(400).json({ errors });
}

// Insert query
const sql = `
    INSERT INTO food_items 
    (retailer_id, name, slug,description, quantity, expiration_date, actual_price, price, is_donated, is_available_for_sale, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
let retailer_id = req.session.user.user_id;
const values = [
    retailer_id,
    name,
    slug,
    description.trim(),
    parseInt(quantity),
    expiration_date,
    actual_price,
    price,
    isDonated,
    isAvailableForSale,
    imagePath
];
console.log(values);
    // Execute the query
    let itemInsertId ;
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting food item:', err);
            return res.status(500).json({ error: 'Database error while inserting food item.' + err.message});
        }
        itemInsertId = result.insertId;
        const sql1 = `
        INSERT INTO inventory_updates 
        (item_id , change_quantity, update_type,updated_by_user_id)
        VALUES (?, ?, ?, ?)
    `;
    const values1 = [itemInsertId,parseInt(quantity),'add', retailer_id];
    db.query(sql1, values1, (err, result) => {
        if (err) {
            console.error('Error inserting inventory item:', err);
            return res.status(500).json({ error: 'Database error while inserting inventory item.' + err.message});
        }
        if(result)
        {
            if(sendNoti)
            {
                req.productData = {
                    id : itemInsertId,
                    name : name,
                    expiry : moment(expiration_date).format('YYYY-MM-DD'),
                    retailer : req.session.user.name,
                    slug:slug,
                    description : description.trim(),
                    actual_price : actual_price,
                    price : price,
                    stock : parseInt(quantity)>1
                };
               
                mw.notifyUsers(req, res, () => {
                    const siteName = req.app.locals.siteName;
                    res.status(201).json({
                        message: 'Food item added successfully.',
                        url : `${siteName}/retailer/fooditems`
                    });
                });
            }
            else{
                    const siteName = req.app.locals.siteName;
                    res.status(201).json({
                        message: 'Food item added successfully.',
                        url : `${siteName}/retailer/fooditems`
                    });
            }
            
            
        }
    });
        
    });
}catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

module.exports = router;