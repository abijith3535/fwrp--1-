
const express = require('express');
const router = express.Router();
const db = require('../db');
const moment = require('moment');
const mw = require('../middleware/middlewareFunctions');

router.get('/:slug', mw.customerAuthentication, async(req, res) => {
    const slug = req.params.slug;
    
    try{
        let retailerIds = [];
        let checkoutFlag = true;
        let query = `
      SELECT fi.item_id,fi.description, fi.slug, fi.name, fi.image, fi.quantity AS stock,fi.retailer_id, 
      fi.actual_price, fi.price, u.name AS retailer, 
      FLOOR(((fi.actual_price - fi.price) / fi.actual_price) * 100) AS discount_percentage, 
      CASE 
      WHEN fi.expiration_date < CURRENT_DATE 
      THEN true 
      ELSE false 
      END AS expiration_flag 
      FROM food_items fi 
      LEFT JOIN users u ON u.user_id = fi.retailer_id WHERE fi.slug =  ?`;
      
        const [foodItemObj] = await db.promise().query(query, [slug]);
        if (!foodItemObj || foodItemObj.length === 0) 
            res.redirect('/not-found'); 
        else{
           
            const foodItemData = {
                
                item_id : foodItemObj[0].item_id,
                slug : foodItemObj[0].slug,
                name : foodItemObj[0].name,
                description : foodItemObj[0].description,
                quantity : foodItemObj[0].stock,
                image : foodItemObj[0].image,
                stock : foodItemObj[0].stock,
                quantity : foodItemObj[0].stock,
                actual_price: foodItemObj[0].actual_price,
                price : foodItemObj[0].price,
                discount_percentage : foodItemObj[0].discount_percentage,
                retailer_id : foodItemObj[0].retailer_id,
                retailer : foodItemObj[0].retailer,
                isExpired : foodItemObj[0].expiration_flag,
                isStockAvailable : foodItemObj[0].stock > 1
                
              };
              console.log(foodItemData);
            const data = { 
                title: 'Food Waste Reduction - '+ foodItemObj[0].name, 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                userCartCount : req.cartCount,
                foodItemData : foodItemData,
                
               
            };
             res.render('customer/single_item', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }      
       
      

  });
router.get('/', mw.customerAuthentication, async(req, res) => {
    let query;
    if(req.session.user.usertype=='consumer')
    {
        query = 'SELECT fi.item_id,fi.slug, fi.name, fi.image, fi.price, fi.actual_price , FLOOR(((fi.actual_price - fi.price) / fi.actual_price) * 100) AS discount_percentage, u.name as retailer FROM food_items fi left join users u on u.user_id = fi.retailer_id  WHERE fi.is_available_for_sale = ? AND fi.expiration_date >= NOW()  ORDER BY fi.item_id DESC';
        
    }
    else
    {
        query = 'SELECT fi.item_id, fi.slug,fi.name, fi.image, fi.price, fi.actual_price , u.name as retailer FROM food_items fi left join users u on u.user_id = fi.retailer_id  WHERE fi.is_donated = ? AND fi.expiration_date >= NOW()  ORDER BY fi.item_id DESC';
        userCartCount = 0;
    }
    db.query(query,[true], (err, results)=>
    {
        if(err)
        {
        return res.status(500).send('Something went wrong! ');
        }
        
        const data = { 
            title: 'Food Waste Reduction - food items' ,
            food_items : results,
            user : req.session.user ? req.session.user: null,
            userCartCount : req.cartCount
        };
    res.render('customer/food_items', data);  
    });
  
});


module.exports = router;