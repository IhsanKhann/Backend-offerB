import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import api from '../../src/api/axios.js';

const DocumentReview = ({ employeeId, document, isFinal, onReviewComplete }) => {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!reviewStatus) {
      alert('Please select a review status');
      return;
    }

    try {
      setSubmitting(true);
      await api.patch(
        `/documents/employees/${employeeId}/documents/${document._id}/review`,
        {
          status: reviewStatus,
          reviewNotes,
          isFinal
        }
      );

      alert('Document reviewed successfully');
      setShowReviewModal(false);
      if (onReviewComplete) {
        onReviewComplete();
      }
    } catch (error) {
      console.error('Review failed:', error);
      alert(error.response?.data?.message || 'Failed to review document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowReviewModal(true)}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Review
      </button>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Review Document</h3>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Document Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FileText className="text-blue-500 mt-1" size={24} />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {document.documentType === 'Other' && document.customDocumentName
                        ? document.customDocumentName
                        : document.documentType}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {document.file.originalName}
                    </p>
                    
                    <a
                      href={document.file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                    >
                      View Full Document →
                    </a>
                  </div>
                </div>
              </div>

              {/* Review Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Review Decision <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setReviewStatus('Approved')}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center space-y-2 transition-all ${
                      reviewStatus === 'Approved'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <CheckCircle
                      className={reviewStatus === 'Approved' ? 'text-green-600' : 'text-gray-400'}
                      size={24}
                    />
                    <span className="text-sm font-medium">Approve</span>
                  </button>

                  <button
                    onClick={() => setReviewStatus('Needs Revision')}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center space-y-2 transition-all ${
                      reviewStatus === 'Needs Revision'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <AlertCircle
                      className={reviewStatus === 'Needs Revision' ? 'text-yellow-600' : 'text-gray-400'}
                      size={24}
                    />
                    <span className="text-sm font-medium">Needs Revision</span>
                  </button>

                  <button
                    onClick={() => setReviewStatus('Rejected')}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center space-y-2 transition-all ${
                      reviewStatus === 'Rejected'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <XCircle
                      className={reviewStatus === 'Rejected' ? 'text-red-600' : 'text-gray-400'}
                      size={24}
                    />
                    <span className="text-sm font-medium">Reject</span>
                  </button>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                  {(reviewStatus === 'Needs Revision' || reviewStatus === 'Rejected') && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows="4"
                  placeholder="Provide feedback or reasons for your decision..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !reviewStatus}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentReview;