const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Sample diet plans data structure
const dietPlans = {
  "vegetarian": {
    "weightloss": {
      "breakfast": "Oatmeal with fruits and nuts",
      "lunch": "Vegetable salad with quinoa",
      "dinner": "Grilled vegetables with tofu",
      "snacks": "Fruits, yogurt"
    },
    "weightgain": {
      "breakfast": "Whole grain toast with avocado and eggs",
      "lunch": "Bean and cheese burrito",
      "dinner": "Lentil curry with rice",
      "snacks": "Nuts, protein shake"
    },
    "maintain": {
      "breakfast": "Smoothie bowl with granola",
      "lunch": "Vegetable wrap with hummus",
      "dinner": "Vegetable stir fry with rice",
      "snacks": "Fruits, nuts"
    }
  },
  "non-vegetarian": {
    "weightloss": {
      "breakfast": "Scrambled eggs with vegetables",
      "lunch": "Grilled chicken salad",
      "dinner": "Baked fish with steamed vegetables",
      "snacks": "Greek yogurt, boiled eggs"
    },
    "weightgain": {
      "breakfast": "Protein pancakes with eggs",
      "lunch": "Chicken and rice bowl",
      "dinner": "Steak with sweet potato",
      "snacks": "Cottage cheese, protein shake"
    },
    "maintain": {
      "breakfast": "Omelette with whole grain toast",
      "lunch": "Turkey sandwich",
      "dinner": "Salmon with quinoa and vegetables",
      "snacks": "Nuts, protein bar"
    }
  }
};

// API endpoint to generate diet plan
app.post('/generate-plan', (req, res) => {
  const userData = req.body;
  
  // Basic validation
  if (!userData.age || !userData.height || !userData.weight || 
      !userData.gender || !userData.workout || !userData.goal || !userData.dietPreference) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Calculate BMI
  const heightInM = userData.height / 100;
  const bmi = userData.weight / (heightInM * heightInM);
  
  // Get appropriate diet plan based on preferences
  let dietPlan;
  try {
    dietPlan = dietPlans[userData.dietPreference.toLowerCase()][userData.goal.toLowerCase()];
  } catch (error) {
    return res.status(400).json({ error: 'Could not generate diet plan with provided parameters' });
  }
  
  // Add personalized recommendations based on BMI
  let recommendations = [];
  if (bmi < 18.5) {
    recommendations.push("Consider increasing calorie intake for weight gain");
  } else if (bmi >= 25) {
    recommendations.push("Consider reducing calorie intake for weight loss");
  } else {
    recommendations.push("Your BMI is in the healthy range. Maintain your current habits");
  }
  
  // Add workout-specific recommendations
  if (userData.workout.toLowerCase().includes('intense')) {
    recommendations.push("Ensure adequate protein intake to support muscle recovery");
  }
  
  // Prepare response
  const response = {
    plan: dietPlan,
    bmi: bmi.toFixed(1),
    recommendations: recommendations,
    userData: userData
  };
  
  // Save to JSON file (simple database)
  fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
    let plans = [];
    if (!err && data) {
      plans = JSON.parse(data);
    }
    plans.push({
      timestamp: new Date().toISOString(),
      ...response
    });
    
    fs.writeFile('data/diet-plans.json', JSON.stringify(plans, null, 2), (err) => {
      if (err) {
        console.error('Error saving diet plan:', err);
      }
    });
  });
  
  res.json(response);
});

// API endpoint to get all saved plans (for debugging)
app.get('/plans', (req, res) => {
  fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read plans data' });
    }
    res.json(JSON.parse(data));
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Create data directory if it doesn't exist
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }
  // Initialize empty JSON file if it doesn't exist
  if (!fs.existsSync('data/diet-plans.json')) {
    fs.writeFileSync('data/diet-plans.json', '[]');
  }
});