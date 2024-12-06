const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const port = 3000;
const db = require('./db');
const mw = require('./middleware/middlewareFunctions');
app.locals.siteName = `http://localhost:${port}`;
app.locals.delievryCharge= 5;
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());
app.use(session({
  secret: 'q2432553465476576587', 
  resave: false,  
  saveUninitialized: true,  
  cookie: { secure: false }  
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const retaileritemsRoute = require('./routes/retailerfooditems');
const retailerAdminRoute = require('./routes/retailerAdmin');
const purchasesRoute = require('./routes/purchases');
const reportRoute = require('./routes/reports');
const registrationRoute = require('./routes/registration');
const loginRoute = require('./routes/login');
const addressRoute = require('./routes/address');
const fooditemsRoute = require('./routes/fooditems');
const retailersRoute = require('./routes/retailers');
const retailerClaimRoute = require('./routes/claims');
const consumerRoute = require('./routes/consumer');
const orgRoute = require('./routes/organisation');
const commonRoute = require('./routes/common');
app.use((req, res, next) => {
  const ignoredExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.ico', '.svg', '.woff', '.woff2', '.ttf'];

  if (!ignoredExtensions.some(ext => req.originalUrl.endsWith(ext))) {
      req.app.locals.browserUrl = req.originalUrl;
      console.log("browserUrl", req.app.locals.browserUrl);
  }
  next();
});
app.use((req, res, next) => {
  if (req.session && req.session.user) {
      res.locals.user = req.session.user; // Attach user details to locals
  } else {
      res.locals.user = null; // If no user is logged in
  }
  next();
});
app.use('/retailer', retailerAdminRoute);//dashboard, inventory updates, profiles
app.use('/retailer/fooditems', retaileritemsRoute);//food item add, item update, list, list surplus items
app.use('/retailer/purchases', purchasesRoute);//purchase list, view, status change
app.use('/retailer/claims', retailerClaimRoute);// claim list, view, status change
app.use('/retailer/reports', reportRoute);// claim and purchase reports
app.use('/registration', registrationRoute);// registration
//...............................................................................................
app.use('/login', loginRoute);//login
app.use('/address', addressRoute);//fron end user address manage
app.use('/food-items', fooditemsRoute);//food items list
app.use('/retailers', retailersRoute);// listing retailers and products
app.use('/consumer', consumerRoute);//cart, checkout, orders , order view
app.use('/organisation', orgRoute);//   organization list, list their products
app.use('/', commonRoute);//profile, edit profile
app.get('/home',async (req, res) => {
  if(req.session.user && req.session.user.usertype!='retailer')
  {
    let homeItems, homeRetailers,userCartCount;
    //const postalcode = req.session.user.address.id;
        try{
         
          let retailerQry = `SELECT u.*
                      FROM users u
                      WHERE u.usertype = 'retailer' AND u.status = 'active' LIMIT 4`;
          const [homeRetailers] = await db.promise().query(retailerQry, ['retailer','active']);
          console.log(homeRetailers);
            if(req.session.user.usertype=='consumer')
            {
              const [itemsData] = await db.promise().query('SELECT name, slug,image,price, actual_price, FLOOR(((actual_price - price) / actual_price) * 100) AS discount_percentage  FROM food_items WHERE is_available_for_sale = ? AND expiration_date >= NOW() ORDER BY item_id DESC LIMIT 4', [true]);
              homeItems = itemsData;
              const [cartCount] = await db.promise().query('SELECT count(*) as cart_count FROM food_cart WHERE consumer_id = ?', [req.session.user.user_id]);
              userCartCount = cartCount.length>0 ? cartCount[0].cart_count : 0;
            }
            else
            {
              const [itemsData] = await db.promise().query('SELECT name, slug,image, DATEDIFF(expiration_date, NOW()) AS days_difference FROM food_items WHERE is_donated = ?  AND expiration_date >= NOW() ORDER BY item_id DESC LIMIT 4', [true]);
              homeItems = itemsData;
              userCartCount = 0;
            } 
          
          
            const data = { 
                title: 'Food Waste Reduction', 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                homeRetailers : homeRetailers,
                homeItems : homeItems,
                userCartCount:userCartCount
          };
          console.log(data);
          res.render('customer/index', data);  
      
      }catch(error)
      {
          res.status(500).send('Error in fetching data');
      }
  }
  else return res.redirect('/login');
});
app.get('/', (req, res) => {
  
  if(req.session.user)
  {
    var user = req.session.user;
    
    if(user.usertype == "retailer")
    {
      return res.redirect('/retailer/dashboard');
    }
    else
    {
      return res.redirect('/home');
    }
  }
  else{
    return res.redirect('/login');
  }
  
});
app.post('/getState', async(req, res) => {
  try{
    const [states] = await db.promise().query('SELECT * FROM states ');
    res.status(200).json({ states: states });
  }catch (error) {
    res.status(500).json({ error: 'Server error.'. error.message });
  }
  
});
app.post('/getCity', async (req, res) => {
  try{
    const state = req.body.state_id;
    const [cities] = await db.promise().query('SELECT * FROM cities WHERE state_id=? ',[state]);
    res.status(200).json({ cities: cities });
  }catch (error) {
    res.status(500).json({ error: 'Server error.'. error.message });
  }
  
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error(err);
          res.status(500).send('Could not log out.');
      } else {
          res.redirect('/login');
      }
  });
});
app.get('/not-found', (req, res) => {
  const data = { 
    title: 'Food Waste Reduction - 404 fot found!', 
    message: 'Welcome to the platform!', 
    user : req.session.user ? req.session.user: null,
   
};
console.log(data);
res.render('customer/error', data);  
});
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});