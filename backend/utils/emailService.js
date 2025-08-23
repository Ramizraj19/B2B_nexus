const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send welcome email
const sendWelcomeEmail = async (email, firstName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"B2B Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to B2B Nexus! 🚀',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px;">Welcome to B2B Nexus!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your B2B e-commerce journey starts here</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Thank you for joining B2B Nexus! We're excited to have you as part of our growing community of businesses.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin-top: 0;">What you can do now:</h3>
              <ul style="color: #666; line-height: 1.6;">
                <li>Complete your company profile</li>
                <li>Browse products from verified sellers</li>
                <li>Connect with other businesses</li>
                <li>Start building your B2B network</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              If you have any questions or need assistance, feel free to reach out to our support team.
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              The B2B Nexus Team
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 B2B Nexus. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"B2B Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - B2B Nexus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px;">Password Reset</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Secure your account</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password for your B2B Nexus account.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="color: #666; line-height: 1.6; margin: 0;">
                <strong>Important:</strong> This link will expire in 1 hour for security reasons.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              The B2B Nexus Team
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 B2B Nexus. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (email, firstName, orderNumber, orderDetails) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"B2B Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - ${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px;">Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${orderNumber}</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Thank you for your order! We've received your request and are processing it.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin-top: 0;">Order Summary:</h3>
              <p style="color: #666; line-height: 1.6; margin: 10px 0;">
                <strong>Order Number:</strong> ${orderNumber}<br>
                <strong>Total Amount:</strong> $${orderDetails.total}<br>
                <strong>Status:</strong> ${orderDetails.status}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/orders/${orderNumber}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                View Order Details
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              We'll keep you updated on the status of your order. If you have any questions, please don't hesitate to contact us.
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              The B2B Nexus Team
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 B2B Nexus. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
};

// Send order status update email
const sendOrderStatusUpdateEmail = async (email, firstName, orderNumber, newStatus, orderDetails) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"B2B Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Status Update - ${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px;">Order Updated!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${orderNumber}</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Your order status has been updated to: <strong>${newStatus}</strong>
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin-top: 0;">Order Details:</h3>
              <p style="color: #666; line-height: 1.6; margin: 10px 0;">
                <strong>Order Number:</strong> ${orderNumber}<br>
                <strong>New Status:</strong> ${newStatus}<br>
                <strong>Total Amount:</strong> $${orderDetails.total}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/orders/${orderNumber}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                View Order Details
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Thank you for choosing B2B Nexus!
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 B2B Nexus. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order status update email sent to ${email}`);
  } catch (error) {
    console.error('Error sending order status update email:', error);
    throw error;
  }
};

// Send new message notification email
const sendNewMessageEmail = async (email, firstName, senderName, conversationTitle) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"B2B Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `New Message from ${senderName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px;">New Message</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">You have a new message</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              You have received a new message from <strong>${senderName}</strong> in the conversation: <strong>${conversationTitle}</strong>
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/messages" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                View Message
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              The B2B Nexus Team
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 B2B Nexus. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`New message email sent to ${email}`);
  } catch (error) {
    console.error('Error sending new message email:', error);
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendNewMessageEmail
};