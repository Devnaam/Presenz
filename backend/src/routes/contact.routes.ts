import { Router, Request, Response } from 'express';
import { FamilyContact, PersonalityProfile, Message, User } from '../models';  // ← added User
import { SubscriptionStatus } from '../types';                                  // ← added

const router = Router();


/**
 * GET /api/v1/contacts
 * UNCHANGED
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const contacts = await FamilyContact.find({ userId }).sort({ createdAt: -1 });

    const contactIds = contacts.map((c) => c._id);
    const profiles = await PersonalityProfile.find({
      contactId: { $in: contactIds }
    }).lean();

    const profileMap = profiles.reduce((acc: Record<string, any>, p) => {
      acc[p.contactId.toString()] = p;
      return acc;
    }, {});

    const enrichedContacts = contacts.map((contact) => {
      const profile = profileMap[contact._id.toString()];
      let aiStatus: 'ready' | 'partial' | 'none' = 'none';
      if (profile) {
        aiStatus = profile.knowledgeBase ? 'ready' : 'partial';
      }
      return { ...contact.toObject(), aiStatus };
    });

    res.status(200).json({
      success: true,
      data: enrichedContacts
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch contacts' });
  }
});


/**
 * POST /api/v1/contacts
 * CHANGED: trial plan limited to 1 active contact
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

    // ── Subscription-based contact limit ─────────────────────────
    // ── Subscription-based contact limit ─────────────────────────
    const CONTACT_LIMITS: Record<string, number> = {
      trial: 1,
      pro: 5,
      business: 999999,
    };

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Block pending and expired users entirely
    if (
      user.subscriptionStatus === SubscriptionStatus.PENDING ||
      user.subscriptionStatus === SubscriptionStatus.EXPIRED
    ) {
      res.status(403).json({
        success: false,
        message:
          user.subscriptionStatus === SubscriptionStatus.PENDING
            ? 'Please activate your free trial to add contacts.'
            : 'Your subscription has expired. Upgrade to add contacts.',
      });
      return;
    }

    // Enforce per-plan contact limit — count ALL contacts (active + inactive)
    // to prevent gaming the limit by deactivating contacts
    const totalContactCount = await FamilyContact.countDocuments({ userId });
    const contactLimit = CONTACT_LIMITS[user.plan] ?? 1;

    if (totalContactCount >= contactLimit) {
      res.status(403).json({
        success: false,
        message: `Your ${user.plan} plan allows ${contactLimit} contact${contactLimit === 1 ? '' : 's'}. Upgrade to add more.`,
      });
      return;
    }
    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────

    const contact = await FamilyContact.create({
      userId,
      name,
      phone,
      relation,
      isActive: true,
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
 * UNCHANGED
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
      res.status(404).json({ success: false, message: 'Contact not found' });
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
      res.status(404).json({ success: false, message: 'Contact not found' });
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
      res.status(404).json({ success: false, message: 'Contact not found' });
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