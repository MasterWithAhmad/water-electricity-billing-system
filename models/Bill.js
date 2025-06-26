const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Import models for associations
const Customer = require('./Customer');
const Payment = require('./Payment');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  billNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'bill_number'
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id',
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  billType: {
    type: DataTypes.ENUM('water', 'electricity', 'combined'),
    allowNull: false
  },
  paymentDueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'payment_due_date',
    defaultValue: DataTypes.NOW
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'due_date',
  },
  previousReading: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'previous_reading',
  },
  currentReading: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'current_reading',
  },
  consumption: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'consumption',
  },
  rate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'tax_amount',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_amount',
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false,
    field: 'payment_status'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
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
  },
  
  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'bills'
});

// Generate a unique bill number before creating a new bill
Bill.beforeCreate(async (bill, options) => {
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

// Define associations
Bill.associate = (models) => {
  Bill.belongsTo(models.Customer, {
    foreignKey: 'customer_id',
    as: 'customer'
  });
  
  Bill.hasMany(models.Payment, {
    foreignKey: 'bill_id',
    as: 'payments'
  });
};

// Set up model name and options
Object.assign(Bill, {
  tableName: 'bills',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Bill;
