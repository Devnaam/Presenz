import { Router, Request, Response } from 'express';
import { FamilyContact, PersonalityProfile, Message } from '../models';


const router = Router();


/**
 * GET /api/v1/contacts
 * UNCHANGED
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    const contacts = await FamilyContact.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contacts
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch contacts'
    });
  }
});


/**
 * POST /api/v1/contacts
 * UNCHANGED
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, name, phone, relation } = req.body;

    if (!userId || !name || !phone || !relation) {
      res.status(400).json({
        success: false,
        message: 'userId, name, phone, and relation are required'
      });
      return;
    }

    const contact = await FamilyContact.create({
      userId,
      name,
      phone,
      relation,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Family contact added successfully',
      data: contact
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add contact'
    });
  }
});


/**
 * PATCH /api/v1/contacts/:id
 * Update contact name, phone, relation — NEW
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, relation } = req.body;

    if (!name || !phone || !relation) {
      res.status(400).json({
        success: false,
        message: 'name, phone, and relation are required'
      });
      return;
    }

    const contact = await FamilyContact.findByIdAndUpdate(
      id,
      { name, phone, relation },
      { new: true, runValidators: true }
    );

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: contact
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update contact'
    });
  }
});


/**
 * PATCH /api/v1/contacts/:id/toggle
 * UNCHANGED
 */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await FamilyContact.findById(id);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    contact.isActive = !contact.isActive;
    await contact.save();

    res.status(200).json({
      success: true,
      message: `Contact ${contact.isActive ? 'activated' : 'deactivated'}`,
      data: contact
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle contact'
    });
  }
});


/**
 * DELETE /api/v1/contacts/:id
 * UNCHANGED
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await FamilyContact.findById(id);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    await Promise.all([
      FamilyContact.findByIdAndDelete(id),
      PersonalityProfile.deleteMany({ contactId: id }),
      Message.deleteMany({ contactId: id }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete contact'
    });
  }
});


export default router;