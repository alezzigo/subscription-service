//
// Name:    user.js
// Purpose: Database model for User
// Creator: Tom Söderlund
//

'use strict'

const { chain, map, merge, omit } = require('lodash')
const mongoose = require('mongoose')
const Schema = mongoose.Schema

const { arrayToCollection, getUniqueSlugFromCollection, isSubscriptionActive, stripIdsFromRet } = require('../lib/helpers')
const Plan = require('mongoose').model('Plan')

// Consumable: e.g. projects, documents, domains
// on User, not Account, to support e.g. projects per user
const UserConsumable = new Schema({
  name: { type: String, required: true },
  current: { type: Number, default: 0 },
  metadata: {} // for extra data
})

const UserSchema = new Schema({
  reference: { type: String, unique: true, required: true, sparse: true }, // can be any string - use same ID as in your own app
  account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  dateCreated: { type: Date, default: Date.now },
  consumables: [UserConsumable], // see above
  metadata: {} // for extra data
},
{
  toJSON: {
    transform: function (doc, ret, options) {
      stripIdsFromRet(doc, ret, options)
    }
  }
})

// Set reference/slug
UserSchema.pre('validate', function (next) {
  const slugSuggestion = this.reference
  getUniqueSlugFromCollection('Account', undefined, slugSuggestion, { documentId: this._id }, (err, uniqueSlug) => {
    if (err) return next(err)
    this.reference = uniqueSlug
    next()
  })
})

UserSchema.methods.getAccounts = function (callback) {
  this.populate('account', '-_id -__v', callback)
}

// TODO: move this so 'includeAllSubscriptions' filter is used on Account too
UserSchema.methods.getSubscriptionPlans = function (options, callback) {
  const filterFunction = options.includeAllSubscriptions ? () => true : isSubscriptionActive
  const selectedSubscriptions = chain(this.account.subscriptions).filter(filterFunction).value()
  const planIds = map(selectedSubscriptions, 'plan')
  Plan.find({ '_id': { $in: planIds } }).exec((err, plans) => {
    if (err) return callback(err)
    const subscriptionsWithPlan = map(selectedSubscriptions, subscription => {
      const plan = chain(plans).find({ _id: subscription.plan }).pick(['name', 'reference', 'price', 'isAvailable']).value()
      const subObj = omit(subscription.toJSON(), ['plan'])
      const subWithPlan = merge({}, subObj, { plan })
      return subWithPlan
    })
    callback(null, { subscriptions: selectedSubscriptions, subscriptionsWithPlan })
  })
}

UserSchema.methods.getServices = function (callback) {
  const planIds = chain(this.account.subscriptions).filter(isSubscriptionActive).map('plan').value()
  Plan.find({ '_id': { $in: planIds } }).populate('services').exec((err, plans) => {
    if (err) return callback(err)
    const allServices = arrayToCollection(chain(plans).map('services').flatten().uniq().value())
    callback(null, allServices)
  })
}

mongoose.model('User', UserSchema)
