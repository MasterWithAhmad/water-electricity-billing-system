'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('admin', 'staff', 'user'),
        defaultValue: 'user',
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      reset_password_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      reset_password_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create customers table
    await queryInterface.createTable('customers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      customer_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false
      },
      postal_code: {
        type: Sequelize.STRING,
        allowNull: false
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Saudi Arabia'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active',
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create bills table
    await queryInterface.createTable('bills', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      bill_number: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bill_type: {
        type: Sequelize.ENUM('water', 'electricity', 'combined'),
        allowNull: false
      },
      issue_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      payment_due_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      previous_reading: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      current_reading: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      consumption: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      rate_per_unit: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false
      },
      fixed_charges: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        allowNull: false
      },
      tax_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'overdue', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false
      },
      payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create payments table
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      payment_number: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bill_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bills',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      bill_number: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'bills',
          key: 'bill_number'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      payment_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'credit_card', 'bank_transfer', 'check', 'other'),
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      reference_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'void'),
        defaultValue: 'pending',
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('customers', ['email'], { unique: true });
    await queryInterface.addIndex('customers', ['customer_id'], { unique: true });
    await queryInterface.addIndex('bills', ['bill_number'], { unique: true });
    await queryInterface.addIndex('bills', ['customer_id']);
    await queryInterface.addIndex('bills', ['payment_status']);
    await queryInterface.addIndex('payments', ['payment_number'], { unique: true });
    await queryInterface.addIndex('payments', ['customer_id']);
    await queryInterface.addIndex('payments', ['bill_id']);
    await queryInterface.addIndex('payments', ['bill_number']);
    await queryInterface.addIndex('payments', ['status']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order to avoid foreign key constraint errors
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('bills');
    await queryInterface.dropTable('customers');
    await queryInterface.dropTable('users');
  }
};
