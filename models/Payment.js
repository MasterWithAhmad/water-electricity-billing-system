const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Import models for associations
const Bill = require('./Bill');
const Customer = require('./Customer');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  paymentNumber: {
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
  billId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bills',
      key: 'id'
    },
    field: 'bill_id'
  },
  billNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'bill_number',
    references: {
      model: 'bills',
      key: 'bill_number'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'bank_transfer', 'online', 'check'),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'void'),
    defaultValue: 'pending',
    allowNull: false
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  receivedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'payments'
});

// Generate a unique payment number before creating a new payment
Payment.beforeCreate(async (payment) => {
  if (!payment.paymentNumber) {
    const prefix = 'PAY';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    payment.paymentNumber = `${prefix}${year}${month}${random}`;
  }
});

// Define associations
Payment.associate = (models) => {
  Payment.belongsTo(models.Customer, {
    foreignKey: 'customer_id',
    as: 'customer'
  });
  
  Payment.belongsTo(models.Bill, {
    foreignKey: 'bill_id',
    as: 'bill'
  });
};

// Set up model name and options
Object.assign(Payment, {
  tableName: 'payments',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// After a payment is created, update the related bill status if applicable
Payment.afterCreate(async (payment, options) => {
  if (payment.billId) {
    const bill = await Bill.findByPk(payment.billId);
    if (bill) {
      const totalPaid = await Payment.sum('amount', {
        where: {
          billId: bill.id,
          status: 'completed'
        }
      });
      
      if (totalPaid >= bill.totalAmount) {
        await bill.update({ status: 'paid', paymentDate: new Date() });
      }
    }
  }
});

module.exports = Payment;
