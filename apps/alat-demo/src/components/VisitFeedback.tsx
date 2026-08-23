"use client";

import { useEffect, useState } from "react";
import { useCorri } from "./CorriProvider";
import { FEEDBACK_CATEGORIES } from "./service-options";

// Changed initialCategory to an array of strings
interface VisitFeedbackProps {
  show: boolean;
  onClose: () => void;
  initialCategories?: string[]; 
}

const POSITIVE_TAGS = ["Friendly Staff", "Fast Service", "Issue Resolved", "Clean Environment"];
const CRITICAL_TAGS = ["Long Wait Time", "Unresolved Issue", "Crowded", "Staff Unresponsive"];

type Step = "form" | "summary" | "success";

export function VisitFeedback({ show, onClose, initialCategories = [] }: VisitFeedbackProps) {
  const { activeBranchName } = useCorri();
  
  const [step, setStep] = useState<Step>("form");
  const [rating, setRating] = useState<number>(0);
  
  // Changed from a single string to an array
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select multiple categories when the modal opens
  useEffect(() => {
    if (show && initialCategories.length > 0) {
      setSelectedCategories(initialCategories);
    }
  }, [initialCategories, show]);

  if (!show) return null;

  const availableTags = rating <= 3 && rating > 0 ? CRITICAL_TAGS : POSITIVE_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags((previous) =>
      previous.includes(tag) ? previous.filter((item) => item !== tag) : [...previous, tag],
    );
  };

  // New toggle function for multiple categories
  const toggleCategory = (category: string) => {
    setSelectedCategories((previous) =>
      previous.includes(category) ? previous.filter((item) => item !== category) : [...previous, category]
    );
  };

  const handleReview = () => {
    setStep("summary");
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    
    // Simulate secure backend API dispatch
    await new Promise((resolve) => setTimeout(resolve, 1200));
    
    console.log("Dispatching Feedback Payload:", {
      branch: activeBranchName,
      rating,
      categories: selectedCategories, // Now sending an array
      tags: selectedTags,
      comment,
    });

    setIsSubmitting(false);
    setStep("success");

    setTimeout(() => {
      onClose();
      setRating(0);
      setSelectedCategories([]);
      setSelectedTags([]);
      setComment("");
      setStep("form");
    }, 3000);
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300 w-full max-w-md mx-auto">
      
      {step === "form" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              How was your visit to {activeBranchName || "Wema"}?
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Help us elevate our branch experience with your feedback.
            </p>
          </div>

          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 hover:cursor-pointer
                  ${
                    rating >= star
                      ? "bg-amber-100 text-amber-500 scale-110 shadow-sm"
                      : "bg-slate-100 text-slate-300 hover:bg-amber-50 hover:text-amber-300"
                  }
                `}
              >
                ★
              </button>
            ))}
          </div>

          {rating > 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  What services did you come for?{" "}
                  {initialCategories.length > 0 && (
                    <span className="text-purple-600 font-normal lowercase">
                      (auto-selected from your request)
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border hover:cursor-pointer ${
                        selectedCategories.includes(category)
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {rating <= 3 ? "What could we improve?" : "What stood out?"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border hover:cursor-pointer ${
                        selectedTags.includes(tag)
                          ? "bg-[#8B0068] text-white border-[#8B0068]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[#8B0068]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Any additional comments or suggestions for the branch manager (optional)..."
                className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B0068] focus:border-transparent outline-none resize-none text-slate-700"
                rows={2}
              />

              <button
                onClick={handleReview}
                style={{ backgroundColor: "#8B0068" }}
                className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition hover:cursor-pointer"
              >
                Review Feedback
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SUMMARY CARD */}
      {step === "summary" && (
        <div className="space-y-5 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Feedback Summary</h2>
            <p className="text-sm text-slate-500 mt-1">
              Please review your insights before we route them to branch operations.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="text-sm text-slate-500">Overall Rating</span>
              <div className="flex gap-1 text-amber-500 text-lg">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={rating >= star ? "opacity-100" : "opacity-30 grayscale"}>
                    ★
                  </span>
                ))}
              </div>
            </div>

            {selectedCategories.length > 0 && (
              <div className="border-b border-slate-200 pb-3">
                <span className="text-sm text-slate-500 block mb-2">Services</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map(cat => (
                    <span key={cat} className="bg-slate-800 text-white text-[11px] px-2 py-1 rounded-md">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedTags.length > 0 && (
              <div className="border-b border-slate-200 pb-3">
                <span className="text-sm text-slate-500 block mb-2">Highlights</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map(tag => (
                    <span key={tag} className="bg-white border border-slate-200 text-slate-600 text-[11px] px-2 py-1 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {comment && (
              <div>
                <span className="text-sm text-slate-500 block mb-1">Additional Notes</span>
                <p className="text-sm text-slate-700 italic bg-white p-3 rounded-md border border-slate-200">
                  "{comment}"
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("form")}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50 hover:cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              style={{ backgroundColor: "#8B0068" }}
              className="flex-2 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 hover:cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                  Sending...
                </>
              ) : (
                "Confirm & Send"
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS */}
      {step === "success" && (
        <div className="text-green-600 font-medium py-8 flex flex-col items-center justify-center gap-3 text-center animate-in zoom-in-95 fade-in">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Feedback Sent!</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Your insights have been securely delivered to the {activeBranchName || "branch"} management team.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}