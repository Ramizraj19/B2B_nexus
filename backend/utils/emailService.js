const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const logger = require('./logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Template cache
const templateCache = {};

// Get template
const getTemplate = (templateName) => {
  if (templateCache[templateName]) {
    return templateCache[templateName];
  }

  const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.hbs`);
  const source = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(source);
  templateCache[templateName] = template;
  return template;
};

// Email service
const emailService = {
  /**
   * Send email using template
   * @param {Object} options - Email options
   * @param {String} options.to - Recipient email
   * @param {String} options.subject - Email subject
   * @param {String} options.template - Template name
   * @param {Object} options.data - Template data
   * @param {Array} [options.attachments] - Email attachments
   */
  async sendEmail(options) {
    try {
      const { to, subject, template, data = {}, attachments = [] } = options;
      
      // Get template
      const compiledTemplate = getTemplate(template);
      const html = compiledTemplate(data);
      
      // Send email
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html,
        attachments
      };
      
      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`, { recipient: to, template });
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  },
  
  // Specific email types
  async sendOrderConfirmation(order) {
    const user = order.user;
    return this.sendEmail({
      to: user.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      template: 'order-confirmation',
      data: {
        userName: user.name,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleDateString(),
        items: order.items,
        subtotal: order.subtotal.toFixed(2),
        tax: order.tax.toFixed(2),
        shipping: order.shipping.toFixed(2),
        total: order.total.toFixed(2),
        shippingAddress: order.shippingAddress
      }
    });
  },
  
  async sendOrderStatusUpdate(order, user) {
    return this.sendEmail({
      to: user.email,
      subject: `Order #${order.orderNumber} Status Update`,
      template: 'order-status-update',
      data: {
        userName: user.name,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        orderStatusMessage: this.getStatusMessage(order.status),
        orderLink: `${process.env.FRONTEND_URL}/orders/${order._id}`
      }
    });
  },
  
  async sendPasswordReset(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data: {
        userName: user.name,
        resetUrl,
        expiryHours: 1 // Token expires in 1 hour
      }
    });
  },
  
  async sendWelcome(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to B2B Nexus',
      template: 'welcome',
      data: {
        userName: user.name,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    });
  },
  
  // Helper methods
  getStatusMessage(status) {
    const statusMessages = {
      'pending': 'Your order is pending confirmation',
      'processing': 'Your order is being processed',
      'shipped': 'Your order has been shipped',
      'delivered': 'Your order has been delivered',
      'cancelled': 'Your order has been cancelled'
    };
    
    return statusMessages[status] || 'Your order status has been updated';
  }
};

module.exports = emailService;