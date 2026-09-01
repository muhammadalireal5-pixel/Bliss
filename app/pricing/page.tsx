'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ArrowLeft } from 'lucide-react';

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/mo',
      leads: '5 leads/month',
      description: 'Intentionally minimal, meant to demonstrate the product.',
      features: ['5 generated emails', 'Basic templates', 'Community support'],
      buttonText: 'Current Plan',
      isPopular: false,
    },
    {
      name: 'Basic',
      price: '$9',
      period: '/mo',
      leads: '150 leads/month',
      description: 'Perfect for small side projects and indie hackers.',
      features: ['150 generated emails', 'Advanced AI personalization', 'Priority support'],
      buttonText: 'Upgrade to Basic',
      isPopular: true,
    },
    {
      name: 'Pro',
      price: '$24',
      period: '/mo',
      leads: '500 leads/month',
      description: 'For growing teams and serious outreach campaigns.',
      features: ['500 generated emails', 'Full AI customization', 'Dedicated account manager'],
      buttonText: 'Upgrade to Pro',
      isPopular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-xl text-slate-600">
            Choose the plan that best fits your outreach needs.
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
          </Link>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative p-8 bg-white border rounded-2xl shadow-sm flex flex-col ${plan.isPopular ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-200'}`}>
              {plan.isPopular && (
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-0">
                  <span className="inline-flex rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold tracking-wider text-white uppercase">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline text-5xl font-extrabold text-slate-900">
                  {plan.price}
                  <span className="ml-1 text-xl font-medium text-slate-500">{plan.period}</span>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-700 bg-slate-100 inline-block px-3 py-1 rounded-full">
                  {plan.leads}
                </div>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="ml-3 text-sm text-slate-700">{feature}</p>
                  </li>
                ))}
              </ul>

              <button 
                className={`w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${plan.isPopular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                onClick={() => alert('Billing is not active yet!')}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
