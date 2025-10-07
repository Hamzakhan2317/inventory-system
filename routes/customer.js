import express from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomersForDropdown,
  restoreCustomer,
  getDeletedCustomers
} from '../controllers/customer.js';

const router = express.Router();

// Customer routes (no authentication/authorization required)
router.get('/dropdown', getCustomersForDropdown);
router.post('/', createCustomer);
router.get('/', getAllCustomers);
router.get('/deleted', getDeletedCustomers);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);
router.patch('/:id/restore', restoreCustomer);

export default router;
