
const db = require('../db');
const nodemailer = require('nodemailer');

async function getEligibleUsers(retailer_id) {
    const query = `
       SELECT DISTINCT 
        u.user_id, 
        u.name AS user_name,
        u.usertype as user_type, 
        u.email as user_email,
        ua.address_id, 
        ua.postalcode, 
        r.user_id, 
        r.name AS retailer_name
        FROM 
            users u
        JOIN 
            user_address ua ON u.user_id = ua.user_id
        JOIN 
            servicable_pincode sp ON sp.postalcode = ua.postalcode
        JOIN 
            users r ON r.user_id = sp.retailer_id
        WHERE 
            r.user_id = ? AND u.is_subscribed=true;
        `;

    try {
        const [users] = await db.promise().query(query, [retailer_id]);
        return users; 
    } catch (err) {
        console.error('Error fetching eligible users:', err.message);
        throw new Error('Database error while fetching eligible users.');
    }
}
async function sendNotifyUser(user, productDetails) {
 
    const subject = `New Product Available: ${productDetails.name}`;
    const txt = user.user_type == 'consumer' ? 'Price' : 'Expiration Date';
    const val = user.user_type == 'consumer' ? '$' +productDetails.price : productDetails.expiry;
    const message = `
        Hello ${user.user_name},
        
        A new product "${productDetails.name}" is now available in your serviceable area!
        Details:
        .......................................................................
        Product Name : ${productDetails.name} 
        ${txt}  : ${val} 
        Retailer : ${productDetails.retailer} 
        Stock : ${productDetails.stock ? 'In-stock' : 'Out of stock'} 
        ........................................................................

        Thank you,
        Retailer Team
    `;

    try {
        await sendEmail(user.user_email, subject, message);
        console.log(`Notification sent to ${user.user_name} (${user.user_email})`);
    } catch (err) {
        console.error(`Failed to notify ${user.user_name}:`, err.message);
    }
}


async function sendEmail(to, subject, message) {
    const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
            user: 'vishakhc88@gmail.com',//ammuamrutha910@gmail.com
            pass: 'nztp gaya brpq sjmk',
        },
    });

    const mailOptions = {
        from: 'vishakhc88@gmail.com',
        to,
        subject,
        text: message,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { getEligibleUsers, sendNotifyUser };
