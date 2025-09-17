import express from 'express';
import {
  createProductType,
  getAllProductTypes,
  getProductTypeById,
  updateProductType,
  deleteProductType,
  getAllProductTypesForDropdown
} from '../controllers/productType.js';

const router = express.Router();

// Get all product types (for dropdowns)
router.get('/dropdown', getAllProductTypesForDropdown);

// CRUD operations for product types
router.post('/', createProductType);
router.get('/', getAllProductTypes);
router.get('/:id', getProductTypeById);
router.put('/:id', updateProductType);
router.delete('/:id', deleteProductType);

export default router;
