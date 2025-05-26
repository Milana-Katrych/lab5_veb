import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function ApartmentCard({ apt, index, onBook, onCancel, isBooked }) {
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviews, setReviews] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const user = auth.currentUser;

  // Динамічний URL для API
  const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const normalizedId = apt.id.split(':')[0];
        const response = await fetch(`${API_URL}/api/reviews/${normalizedId}?page=${currentPage}`);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        const data = await response.json();
        console.log(`Fetched reviews for page ${currentPage}:`, data);
        setReviews(data.reviews || []);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        console.error('Error fetching reviews:', error.message);
      }
    };
    if (apt.id) fetchReviews();
  }, [apt.id, currentPage]);

  const handlePrev = () => {
    setCurrentPhoto((prev) => (prev === 0 ? apt.photos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentPhoto((prev) => (prev === apt.photos.length - 1 ? 0 : prev + 1));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please log in to leave a review.');
      console.error('User not authenticated:', user);
      return;
    }
    if (!isBooked) {
      alert('You can only leave a review for booked apartments.');
      return;
    }
    if (!reviewText.trim()) {
      alert('Review text cannot be empty.');
      return;
    }
    try {
      console.log('User:', user.uid, 'Attempting to add review for apartment:', apt.id);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let userData = { firstName: 'Unknown', lastName: '' };
      if (userDoc.exists()) {
        userData = userDoc.data();
      } else {
        userData = {
          firstName: user.displayName?.split(' ')[0] || 'Unknown',
          lastName: user.displayName?.split(' ')[1] || '',
          email: user.email,
        };
        await setDoc(doc(db, 'users', user.uid), userData);
      }

      const normalizedId = apt.id.split(':')[0];
      const response = await fetch(`${API_URL}/api/reviews/${normalizedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: reviewText,
          userId: user.uid,
          firstName: userData.firstName,
          lastName: userData.lastName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      const data = await response.json();
      console.log('Review added:', data);
      setReviewText('');
      const reviewsResponse = await fetch(`${API_URL}/api/reviews/${normalizedId}?page=1`);
      if (!reviewsResponse.ok) {
        throw new Error(`HTTP error! Status: ${reviewsResponse.status}`);
      }
      const reviewsData = await reviewsResponse.json();
      setReviews(reviewsData.reviews || []);
      setTotalPages(reviewsData.totalPages || 1);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error adding review:', err.message);
      alert('Failed to add review: ' + err.message);
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const formatDate = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'string') return 'Date unavailable';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Kyiv',
    });
  };

  return (
    <div className="apartment-move">
      <div className="apart-photos">
        <div className="photo">
          <img
            src={apt.photos[currentPhoto]}
            alt={`${apt.name} ${currentPhoto + 1}`}
          />
          <button className="prev" onClick={handlePrev}>
            ❮
          </button>
          <button className="next" onClick={handleNext}>
            ❯
          </button>
        </div>
      </div>
      <div className="apart-info">
        <h3>{apt.name}</h3>
        <p>{apt.rooms} room{apt.rooms > 1 ? 's' : ''}</p>
        <p>{apt.price} uah per night</p>
        <details>
          <summary>Features</summary>
          <ul>
            {apt.features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
        </details>
        {user && isBooked && (
          <form onSubmit={handleReviewSubmit} style={{ marginTop: '20px' }}>
            <label>Leave a review:</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              required
            />
            <button type="submit">Submit Review</button>
          </form>
        )}
        <details style={{ marginTop: '20px' }}>
          <summary>Reviews</summary>
          {reviews.length > 0 ? (
            <>
              <ul>
                {reviews.map((review, i) => (
                  <li key={i}>
                    <p>
                      <strong>{review.firstName} {review.lastName}</strong> (
                      {formatDate(review.timestamp)}
                      ):
                    </p>
                    <p>{review.text}</p>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`pagination-button ${currentPage === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="pagination-button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>No reviews yet😢</p>
          )}
        </details>
        {isBooked ? (
          <button className="book" onClick={() => onCancel(index)}>
            Cancel
          </button>
        ) : (
          <button className="book" onClick={() => onBook(index)}>
            Book
          </button>
        )}
      </div>
    </div>
  );
}

export default ApartmentCard;