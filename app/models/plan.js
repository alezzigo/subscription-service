//
// Name:    plan.js
// Purpose: Database model for Plan, something an Account can Subscribe to.
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const helpers = require('../config/helpers');

// Consumable: e.g. projects, documents
const Consumable = new Schema({
	name: { type: String, required: true },
	max: { type: Number, required: true },
	per: { type: String },
});

const PlanSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	dateCreated: { type: Date, default: Date.now },
	isAvailable: { type: Boolean, default: true }, // false: retired plan
	price: {
		monthly: Number,
		yearly: Number,
		once: Number,
		vatIncluded: Boolean,
	},
	trialDays: { type: Number },
	consumables: [Consumable], // see above
	services: [{ type: Schema.Types.ObjectId, ref: 'Service' }], // see service.js
});

// Set reference/slug
PlanSchema.pre('validate', function (next) {
	this.reference = helpers.toSlug(this.reference || this.name);
	next();
});

mongoose.model('Plan', PlanSchema);