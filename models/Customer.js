const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Import models for associations
const Bill = require('./Bill');
const Payment = require('./Payment');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'customer_id',
    validate: {
      notEmpty: {
        msg: 'Customer ID is required'
      }
    }
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'first_name',
    validate: {
      notEmpty: {
        msg: 'First name is required'
      }
    }
  },
  lastName: {
    type: DataTypes.STRING,
    field: 'last_name',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Last name is required'
      }
    }
  },
  email: {
    type: DataTypes.STRING,
    field: 'email',
    allowNull: false,
    validate: {
      isEmail: {
        msg: 'Please enter a valid email address'
      },
      notEmpty: {
        msg: 'Email is required'
      }
    }
  },
  phone: {
    type: DataTypes.STRING,
    field: 'phone',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Phone number is required'
      }
    }
  },
  address: {
    type: DataTypes.TEXT,
    field: 'address',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Address is required'
      }
    }
  },
  city: {
    type: DataTypes.STRING,
    field: 'city',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'City is required'
      }
    }
  },
  country: {
    type: DataTypes.STRING,
    field: 'country',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Country is required'
      }
    }
  },
  postalCode: {
    type: DataTypes.STRING,
    field: 'postal_code',
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Postal code is required'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  waterMeterNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  electricityMeterNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  connectionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
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
  tableName: 'customers'
});

// Generate a unique customer ID before creating a new customer
Customer.beforeCreate(async (customer) => {
  if (!customer.customerId) {
    const prefix = 'CUST';
    const random = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
    const timestamp = Date.now().toString().slice(-6);
    customer.customerId = `${prefix}${timestamp}${random}`.slice(0, 15);
  }
});

// Define associations
Customer.associate = (models) => {
  Customer.hasMany(models.Bill, {
    foreignKey: 'customer_id',
    as: 'bills'
  });
  
  Customer.hasMany(models.Payment, {
    foreignKey: 'customer_id',
    as: 'payments'
  });
};

module.exports = Customer;
