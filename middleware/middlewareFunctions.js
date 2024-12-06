const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { getEligibleUsers , sendNotifyUser} = require('../utils/notifyUser');
function authentication(req, res, next) {
    if (req.session && req.session.user) 
    {
      next();
    } else 
    {
      res.redirect('/login'); 
    }
}
async function customerAuthentication(req, res, next) {
  if (req.session && req.session.user && (req.session.user.usertype=='consumer' || req.session.user.usertype=='charity')) 
  {
    let cartCount = 0;
    if(req.session.user.usertype=='consumer')
    {
      const   query = 'SELECT fi.item_id,fi.slug, fi.name, fi.image, fi.price, fi.actual_price , FLOOR(((fi.actual_price - fi.price) / fi.actual_price) * 100) AS discount_percentage, u.name as retailer FROM food_items fi left join users u on u.user_id = fi.retailer_id  WHERE fi.is_available_for_sale = ? AND fi.expiration_date >= NOW()  ORDER BY fi.item_id DESC';
      const [cartCountObj] = await db.promise().query('SELECT count(*) as cart_count FROM food_cart WHERE consumer_id = ?', [req.session.user.user_id]);
      cartCount = cartCountObj.length>0 ? cartCountObj[0].cart_count : 0;
      req.cartCount = cartCount;
    }
    else req.cartCount = cartCount;
    next();
  } else 
  {
    if (req.xhr) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    else res.redirect('/not-found'); 
  }
}
async function retailerAuthentication(req, res, next) {
  if (req.session && req.session.user && req.session.user.usertype =='retailer') 
  {
    next();
  } else 
  {
    if (req.xhr) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    else res.redirect('/not-found'); 
  }
}
async function checkCartItems(req, res, next) {
 console.log('middel');
 
if( req.session.user && req.session.user.usertype =='consumer')
{
  if(req.cartCount >0)
  {
      let cartData = [];
      let retailerIds = [];
      let checkoutFlag = true;
      let sub_total  = 0;
      const cartQuery = `
      SELECT 
        fc.cart_id, fc.item_id, fi.slug, fi.name, fi.image, fi.quantity AS stock,fi.retailer_id, 
        fc.discount_price, fc.quantity, fc.total_price, u.name AS retailer,
        CASE 
          WHEN fi.expiration_date < CURRENT_DATE THEN true
          ELSE false
        END AS expiration_flag
      FROM 
        food_cart fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id  
        LEFT JOIN users u ON u.user_id = fi.retailer_id   
      WHERE 
        fc.consumer_id = ?;
    `;
      const userId = req.session.user.user_id;
      const userPostalCode = req.session.user.address.postalcode;
      const [cartItems] = await db.promise().query(cartQuery, [userId]);
      
      if (Array.isArray(cartItems) && cartItems.length > 0){  
        for(let i=0;i < cartItems.length; i++)
        {
          if (!retailerIds.includes(cartItems[i].retailer_id)) {
            retailerIds.push(cartItems[i].retailer_id); 
          }
        }
      }
     console.log("retailerIds",retailerIds);
      const serviceableQuery = `
      SELECT retailer_id 
      FROM servicable_pincode 
      WHERE retailer_id IN (?) AND postalcode = ?;
    `;
    
    const [serviceableData] = await db.promise().query(serviceableQuery, [retailerIds, userPostalCode]);
      console.log("serviceableData",serviceableData);
      if (Array.isArray(cartItems) && cartItems.length > 0){  
        
        for(let i=0;i < cartItems.length; i++)
        {
          const isStockAvailable = cartItems[i].stock >= cartItems[i].quantity;
          const isServiceable = serviceableData.some(
            service => service.retailer_id === cartItems[i].retailer_id
          );
          const itemArr = {
            cart_id : cartItems[i].cart_id,
            item_id : cartItems[i].item_id,
            slug : cartItems[i].slug,
            name : cartItems[i].name,
            image : cartItems[i].image,
            stock : cartItems[i].stock,
            quantity : cartItems[i].quantity,
            discount_price: cartItems[i].discount_price,
            total_price : cartItems[i].total_price,
            retailer_id : cartItems[i].retailer_id,
            retailer : cartItems[i].retailer,
            isExpired : cartItems[i].expiration_flag,
            isStockAvailable : isStockAvailable,
            isServiceable : isServiceable
          };
          if(cartItems[i].expiration_flag || !isStockAvailable || !isServiceable)
          {
            checkoutFlag = false;
          }
          else{
            sub_total = parseFloat(cartItems[i].total_price) + parseFloat(sub_total);
          }
          cartData.push(itemArr);

        }
      } 
      console.log("checkoutFlag", checkoutFlag);   
      req.cartData = cartData;
      req.checkoutFlag = checkoutFlag;
      req.sub_total = sub_total;
      req.retailerIds = retailerIds;
      next();
    }
    else{
        
      req.cartData = [];
      req.checkoutFlag = false;
      req.sub_total = 0.00;
      retailerIds = [];
      next();
    }
  }
  else
  {
    res.status(500).send("unable to view the page");
  }
}
async function createOrder(req, res, next) {
    if(req.checkoutFlag)
    {
       let orderIds = [];
        const retailerIds = req.retailerIds;
        for(let j=0;j<retailerIds.length;j++)
        {
            let order_id=0;
            const filteredItems = req.cartData.filter(item => item.retailer_id === retailerIds[j]);
            let sub_total = 0;
            for(let i=0;i < filteredItems.length; i++)
            {
              sub_total = sub_total + parseFloat(filteredItems[i].total_price);
            }
            
            const delievryCharge = req.app.locals.delievryCharge;
            let grand_total = parseFloat(sub_total) + parseFloat(delievryCharge);
            const orderId = uuidv4().slice(0, 8);
            const sql = `
                INSERT INTO food_order 
                (order_unique,consumer_id,retailer_id, address_id, total_price, delivery_charge, grand_total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?,? )
            `;
            const values = [
                orderId,
                req.session.user.user_id,
                retailerIds[j],
                req.session.user.address.id,
                sub_total.toFixed(2),
                delievryCharge.toFixed(2),
                grand_total.toFixed(2),
                'created'
    
            ];
            
            // Execute the query
            db.query(sql, values, (err, result) => {
              if (err) {
                  console.log('food_order', err.message);
                  res.status(500).json({ error: 'Database error while inserting order.' });
                  return; 
              }
          
              // Order ID from the result
              const order_id = result.insertId;
              orderIds.push(order_id);
              console.log("order_id", order_id);
          
              // Attach the order ID to the request object
              
              
              const sql = `INSERT INTO food_purchases (order_id,  item_id, discount_price, quantity, total_price) VALUES  ?`;
        const values = filteredItems.map(item => [
            order_id,
            item.item_id,
            item.discount_price,
            item.quantity,
            item.total_price,
            
            ]);
            console.log(values);
            db.query(sql, [values], (err, result) => {
            if (err) {
                console.log(err.message);
                res.status(500).json({ error: 'Database error while inserting order.' });
            }
            req.orderIds = orderIds;
            next();
           
        }); 
              
          });
        }
        
        
    }
    else{
      return res.status(500).json({ error: 'Not allowed to checkout order' });
                    
    }
 }
 async function updateInventory(req, res, next) {
  if(req.checkoutFlag)
  {
    
      const orderIds = req.orderIds;
      const orderItemsQry = `
      SELECT *  
      FROM food_purchases 
      WHERE order_id IN (?)
    `;
    const [orderItems] = await db.promise().query(orderItemsQry, [orderIds]);
    
    const inventoryItems = orderItems.map(item => [
      item.item_id,
      item.quantity,
      'purchase',
      req.session.user.user_id
      
      ]);
      const sql = `INSERT INTO inventory_updates (item_id ,  change_quantity, update_type, updated_by_user_id ) VALUES  ?`;
      db.query(sql, [inventoryItems], (err, result) => {
        if (err) {
            console.log(err.message);
            res.status(500).json({ error: 'Database error while inserting inventory.' });
        }
        let sql = `UPDATE food_items SET quantity = CASE `;
        const ids = [];
        let cartInfo  = req.cartData;
        cartInfo.forEach(cInfo => {
           
            sql += `WHEN item_id = ${cInfo.item_id} THEN quantity - ${cInfo.quantity} `;
            ids.push(cInfo.item_id);
          });

        sql += `END WHERE item_id IN (?);`;
        db.query(sql, [ids], (err, result) => {
          if (err) {
              console.log(err.message);
              res.status(500).json({ error: 'Database error while update item quantity.' });
          }
        });   
        next();
       
    });   
      
  }
  else{
    return res.status(500).json({ error: 'Not allowed to checkout order' });
                  
  }
}

  async function notifyUsers(req, res, next) {
    console.log("notifyUsers");
  try {
      const users = await getEligibleUsers(req.session.user.user_id);
      console.log(users);
      users.forEach((user) => {
        sendNotifyUser(user,req.productData);
    });
      next();
  } catch (err) {
      res.status(500).json({ message: 'Error while notifying users.' });
  }
};
module.exports = {
  authentication,checkCartItems,createOrder,customerAuthentication,retailerAuthentication,updateInventory,notifyUsers
};