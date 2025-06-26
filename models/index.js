const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Customer = require('./Customer');
const Bill = require('./Bill');
const Payment = require('./Payment');

// Initialize models
const models = {
  User,
  Customer,
  Bill,
  Payment,
  sequelize
};

// Set up associations
Object.values(models)
  .filter(model => typeof model.associate === 'function')
  .forEach(model => model.associate(models));

// Export models and sequelize instance
module.exports = models;
