const express = require('express');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit, startAfter, addDoc } = require('firebase/firestore');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

const firebaseConfig = {
  apiKey: "AIzaSyA4OzEY5QQGQjACKeQzHXDILO5TER_lcpk",
  authDomain: "laba4-d5b38.firebaseapp.com",
  projectId: "laba4-d5b38",
  storageBucket: "laba4-d5b38.firebasestorage.app",
  messagingSenderId: "945829704514",
  appId: "1:945829704514:web:b3188624b69c4317520edb",
  measurementId: "G-F1WV7NY3WG"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(cors({
  origin: 'https://apartlive.onrender.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());

const negativeWords = [
  'bad', 'poor', 'terrible', 'awful', 'horrible',
  'dreadful', 'lousy', 'worst', 'unsatisfactory',
  'disappointing', 'subpar', 'unpleasant', 'negative'
];

app.get('/api/reviews/:apartmentId', async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const normalizedApartmentId = apartmentId.split(':')[0].replace('-', '_');

    const reviewsRef = collection(db, `reviews/${normalizedApartmentId}/review_id`);
    const snapshot = await getDocs(query(reviewsRef));
    const totalReviews = snapshot.size;
    const totalPages = Math.ceil(totalReviews / 10);

    let q = query(reviewsRef, orderBy('timestamp', 'desc'), limit(10));
    if (parseInt(req.query.page) > 1) {
      const startIndex = (parseInt(req.query.page) - 1) * 10;
      const firstPageSnapshot = await getDocs(query(reviewsRef, orderBy('timestamp', 'desc'), limit(startIndex)));
      const lastVisible = firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1];
      if (lastVisible) {
        q = query(reviewsRef, orderBy('timestamp', 'desc'), startAfter(lastVisible), limit(10));
      } else {
        return res.json({
          reviews: [],
          currentPage: parseInt(req.query.page) || 1,
          totalPages,
          totalReviews,
          hasMore: (parseInt(req.query.page) || 1) < totalPages
        });
      }
    }

    const querySnapshot = await getDocs(q);
    const reviews = querySnapshot.docs.map(doc => {
      const data = doc.data();
      let timestamp = data.timestamp;
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        timestamp = data.timestamp.toDate().toISOString();
      } else if (data.timestamp && isNaN(new Date(data.timestamp).getTime())) {
        timestamp = new Date().toISOString();
      }

      return {
        id: doc.id,
        text: data.text || 'No text',
        firstName: data.firstName || 'Unknown',
        lastName: data.lastName || '',
        timestamp: timestamp
      };
    });

    res.json({
      reviews,
      currentPage: parseInt(req.query.page) || 1,
      totalPages,
      totalReviews,
      hasMore: (parseInt(req.query.page) || 1) < totalPages
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews/:apartmentId', async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const normalizedApartmentId = apartmentId.split(':')[0].replace('-', '_');
    const { text, userId, firstName, lastName } = req.body;

    if (!text || !userId) {
      return res.status(400).json({ error: 'Text and userId are required' });
    }

    const containsNegativeWords = negativeWords.some(word => 
      text.toLowerCase().includes(word.toLowerCase())
    );

    const reviewRef = collection(db, `reviews/${normalizedApartmentId}/review_id`);
    const newReviewRef = await addDoc(reviewRef, {
      text,
      userId,
      firstName: firstName || 'Unknown',
      lastName: lastName || '',
      timestamp: new Date().toISOString()
    });

    const response = {
      message: 'Review added',
      reviewId: newReviewRef.id
    };

    if (containsNegativeWords) {
      response.negativeFeedbackMessage = 'Sorry you didn\'t like it. Please contact us to share more details.';
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});