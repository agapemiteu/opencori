"use client";

import { useState } from "react";
import { useCorri } from "./CorriProvider";

interface VisitFeedbackProps {
  show: boolean;
  onClose: () => void;
}

const SERVICE_CATEGORIES = [
  "Card Issuance",
  "Account Opening",
  "Enquiry / Support",
  "Loan Services",
  "Deposit / Withdrawal"
];

const POSITIVE_TAGS = ["Friendly Staff", "Fast Service", "Issue Resolved", "Clean Environment"];
const CRITICAL_TAGS = ["Long Wait Time", "Unresolved Issue", "Crowded", "Staff Unresponsive"];

export function VisitFeedback({ show, onClose }: VisitFeedbackProps) {
  const { activeBranchName } = useCorri();
  const [rating, setRating] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!show) return null;

  const availableTags = rating <= 3 && rating > 0 ? CRITICAL_TAGS : POSITIVE_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate secure backend API dispatch for demo purposes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Comprehensive Feedback Payload:", { 
      branch: activeBranchName, 
      rating, 
      category: selectedCategory, 
      tags: selectedTags, 
      comment 
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
    
    setTimeout(() => {
      onClose();
      // Reset form state
      setRating(0);
      setSelectedCategory("");
      setSelectedTags([]);
      setComment("");
      setIsSubmitted(false);
    }, 3000);
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300">
      {!isSubmitted ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              How was your visit to {activeBranchName || "Wema"}?
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Help us elevate our branch experience with your feedback.
            </p>
          </div>
          
          {/* Star Rating */}
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all outline-none 
                  ${rating >= star ? 'bg-amber-100 text-amber-500 scale-110 shadow-sm' : 'bg-slate-100 text-slate-300 hover:bg-amber-50 hover:text-amber-300'}
                `}
              >
                ★
              </button>
            ))}
          </div>

          {/* Conditional Extended Comprehensive Section */}
          {rating > 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
              
              {/* Service Category Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  What service did you come for?
                </label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedCategory === category 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Feedback Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {rating <= 3 ? "What could we improve?" : "What stood out?"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        selectedTags.includes(tag) 
                          ? 'bg-[#8B0068] text-white border-[#8B0068]' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B0068]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Comment Box */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any additional comments or suggestions for the branch manager (optional)..."
                className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B0068] focus:border-transparent outline-none resize-none text-slate-700"
                rows={2}
              />

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ backgroundColor: '#8B0068' }}
                className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {isSubmitting ? "Encrypting & Submitting..." : "Submit Comprehensive Feedback"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-green-600 font-medium py-8 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Thank you for your feedback!</h3>
            <p className="text-xs text-slate-500 mt-0.5">Your insights have been routed securely to branch operations.</p>
          </div>
        </div>
      )}
    </section>
  );
}