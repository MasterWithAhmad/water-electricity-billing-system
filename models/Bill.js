const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Customer = require('./Customer');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  billNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  billType: {
    type: DataTypes.ENUM('water', 'electricity', 'combined'),
    allowNull: false
  },
  issueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  previousReading: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  currentReading: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  consumption: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  rate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled'),
    defaultValue: 'pending'
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'bank_transfer', 'online'),
    allowNull: true
  },
  paymentReference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'bills'
});

// Generate a unique bill number before creating a new bill
Bill.beforeCreate(async (bill) => {
  if (!bill.billNumber) {
    const prefix = bill.billType === 'water' ? 'WTR' : 
                  bill.billType === 'electricity' ? 'ELC' : 'BL';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    bill.billNumber = `${prefix}${year}${month}${random}`;
  }
  
  // Calculate consumption if not provided
  if (bill.currentReading && bill.previousReading && !bill.consumption) {
    bill.consumption = parseFloat((bill.currentReading - bill.previousReading).toFixed(2));
  }
  
  // Calculate amount if not provided
  if (!bill.amount && bill.consumption && bill.rate) {
    bill.amount = parseFloat((bill.consumption * bill.rate).toFixed(2));
  }
  
  // Calculate tax amount if not provided
  if (!bill.taxAmount && bill.amount && bill.taxRate) {
    bill.taxAmount = parseFloat(((bill.amount * bill.taxRate) / 100).toFixed(2));
  }
  
  // Calculate total amount if not provided
  if (!bill.totalAmount && bill.amount !== undefined && bill.taxAmount !== undefined) {
    bill.totalAmount = parseFloat((parseFloat(bill.amount) + parseFloat(bill.taxAmount)).toFixed(2));
  }
});

// Define association with Customer
Bill.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Bill, { foreignKey: 'customerId', as: 'bills' });

module.exports = Bill;
