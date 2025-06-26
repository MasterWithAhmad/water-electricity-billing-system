const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

// Import models for associations
const Bill = require('./Bill');
const Payment = require('./Payment');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'name',
    validate: {
      notEmpty: {
        msg: 'Name is required'
      },
      len: {
        args: [2, 50],
        msg: 'Name must be between 2 and 50 characters'
      }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'email',
    unique: {
      msg: 'Email already in use'
    },
    validate: {
      isEmail: {
        msg: 'Please enter a valid email address'
      },
      notEmpty: {
        msg: 'Email is required'
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password',
    validate: {
      notEmpty: {
        msg: 'Password is required'
      },
      len: {
        args: [6, 100],
        msg: 'Password must be at least 6 characters long'
      }
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'staff', 'user'),
    defaultValue: 'user',
    allowNull: false,
    field: 'role'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    field: 'is_active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'reset_password_token'
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_password_expires'
  },
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
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Instance method to check password
User.prototype.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Class method to find by credentials
User.findByCredentials = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('Unable to login');
  }
  const isMatch = await user.validPassword(password);
  if (!isMatch) {
    throw new Error('Unable to login');
  }
  return user;
};

// Define associations
User.associate = (models) => {
  User.hasMany(models.Bill, {
    foreignKey: 'created_by',
    as: 'bills_created'
  });
  
  User.hasMany(models.Payment, {
    foreignKey: 'created_by',
    as: 'payments_processed'
  });
};

// Set up model name and options
Object.assign(User, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  defaultScope: {
    attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
  },
  scopes: {
    withPassword: {
      attributes: {}
    }
  }
});

module.exports = User;
