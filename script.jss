// Calculate BMR based on Mifflin-St Jeor Equation
function calculateBMR(weight, height, age, gender) {
    if (gender === 'male') {
        return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        return 10 * weight + 6.25 * height - 5 * age - 161;
    }
}

// Calculate TDEE based on activity level
function calculateTDEE(bmr, activityLevel) {
    const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        extra: 1.9
    };
    return bmr * activityMultipliers[activityLevel];
}

// Adjust calories based on fitness goal
function adjustCaloriesForGoal(tdee, goal) {
    const goalAdjustments = {
        fatloss: -500,
        maintain: 0,
        muscle: 500
    };
    return tdee + goalAdjustments[goal];
}

// Calculate macronutrient distribution
function calculateMacros(calories, goal) {
    let proteinRatio, fatRatio, carbRatio;
    
    switch(goal) {
        case 'fatloss':
            proteinRatio = 0.4;
            fatRatio = 0.25;
            carbRatio = 0.35;
            break;
        case 'muscle':
            proteinRatio = 0.35;
            fatRatio = 0.25;
            carbRatio = 0.4;
            break;
        case 'maintain':
        default:
            proteinRatio = 0.3;
            fatRatio = 0.25;
            carbRatio = 0.45;
    }
    
    return {
        protein: Math.round((calories * proteinRatio) / 4), // 4 calories per gram
        carbs: Math.round((calories * carbRatio) / 4),
        fat: Math.round((calories * fatRatio) / 9) // 9 calories per gram
    };
}

// Food database with macros per 100g
const foodDatabase = {
    veg: {
        oats: { protein: 13, carbs: 68, fat: 7, fiber: 10 },
        banana: { protein: 1, carbs: 23, fat: 0, fiber: 2.6 },
        milk: { protein: 3.4, carbs: 5, fat: 3.6, fiber: 0 },
        paneer: { protein: 18, carbs: 3.4, fat: 20, fiber: 0 },
        soya: { protein: 52, carbs: 30, fat: 1, fiber: 9.3 },
        rice: { protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
        carrot: { protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 },
        beetroot: { protein: 1.6, carbs: 10, fat: 0.2, fiber: 2.8 },
        chia: { protein: 17, carbs: 42, fat: 31, fiber: 34 }
    },
    nonVeg: {
        chicken: { protein: 27, carbs: 0, fat: 4, fiber: 0 },
        eggs: { protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
        fish: { protein: 22, carbs: 0, fat: 10, fiber: 0 }
    }
};

// Generate meal plan based on user preferences
function generateMealPlan(calories, macros, dietType) {
    const meals = {
        breakfast: { protein: 0.25, carbs: 0.3, fat: 0.25 },
        lunch: { protein: 0.35, carbs: 0.4, fat: 0.35 },
        dinner: { protein: 0.3, carbs: 0.25, fat: 0.3 },
        snack: { protein: 0.1, carbs: 0.05, fat: 0.1 }
    };
    
    const mealPlan = {};
    const foodPool = dietType === 'veg' ? {...foodDatabase.veg} : {...foodDatabase.veg, ...foodDatabase.nonVeg};
    
    for (const [meal, ratios] of Object.entries(meals)) {
        const mealCalories = calories * 0.25; // Each meal is ~25% of daily calories
        const mealMacros = {
            protein: Math.round(macros.protein * ratios.protein),
            carbs: Math.round(macros.carbs * ratios.carbs),
            fat: Math.round(macros.fat * ratios.fat)
        };
        
        // Generate meal suggestions
        const suggestions = generateMealSuggestions(mealMacros, foodPool, meal);
        
        mealPlan[meal] = {
            macros: mealMacros,
            suggestions: suggestions,
            cookingTips: getCookingTips(meal, dietType)
        };
    }
    
    return mealPlan;
}

// Generate meal suggestions based on macros
function generateMealSuggestions(mealMacros, foodPool, mealType) {
    const suggestions = [];
    
    // Breakfast suggestions
    if (mealType === 'breakfast') {
        suggestions.push(
            "Oats (50g) with milk (200ml) and banana (1 medium) - provides sustained energy",
            "Scrambled eggs (2) with whole wheat toast (2 slices) and vegetables",
            "Smoothie with banana, milk, oats and chia seeds (1 tbsp)"
        );
    }
    // Lunch suggestions
    else if (mealType === 'lunch') {
        suggestions.push(
            "Grilled chicken/fish (150g) with brown rice (100g) and steamed vegetables",
            "Paneer/soya chunks (150g) curry with 2 chapati and salad",
            "Vegetable rice with protein source (chicken/paneer/soya) and side salad"
        );
    }
    // Dinner suggestions
    else if (mealType === 'dinner') {
        suggestions.push(
            "Grilled protein (120g) with quinoa (80g) and roasted vegetables",
            "Stir-fried vegetables with tofu/chicken and brown rice (80g)",
            "Lean protein with sweet potato (100g) and green vegetables"
        );
    }
    // Snack suggestions
    else {
        suggestions.push(
            "Handful of nuts (almonds/walnuts) with a fruit",
            "Greek yogurt (150g) with berries",
            "Protein shake with water/milk"
        );
    }
    
    return suggestions;
}

// Get cooking tips based on meal type
function getCookingTips(meal, dietType) {
    const tips = {
        breakfast: [
            "Soak oats overnight for quicker preparation in the morning",
            "Add chia seeds to smoothies for extra fiber and omega-3",
            "Use non-stick pan to reduce oil usage"
        ],
        lunch: [
            "Meal prep on weekends to save time during weekdays",
            "Steam vegetables instead of boiling to retain nutrients",
            "Use herbs and spices instead of salt for flavor"
        ],
        dinner: [
            "Grill or bake instead of frying for healthier options",
            "Include a variety of colored vegetables for diverse nutrients",
            "Keep dinners lighter to aid digestion before sleep"
        ],
        snack: [
            "Pre-portion snacks to avoid overeating",
            "Combine protein with carbs for sustained energy",
            "Keep healthy snacks visible and accessible"
        ]
    };
    
    return tips[meal];
}

// Format and display results
function displayResults(userData, tdee, goalCalories, macros, mealPlan) {
    const resultsSection = document.getElementById('results');
    const userSummary = document.getElementById('userSummary');
    const macroResults = document.getElementById('macroResults');
    const mealPlanResults = document.getElementById('mealPlanResults');
    
    // Update user summary
    userSummary.innerHTML = `
        <p>Age: ${userData.age} years | Gender: ${userData.gender} | Weight: ${userData.weight} kg</p>
        <p>Height: ${userData.height} cm | Activity Level: ${userData.activity}</p>
        <p>Fitness Goal: ${userData.goal} | Diet Preference: ${userData.dietType}</p>
        <p>Your maintenance calories: <strong>${Math.round(tdee)}</strong></p>
        <p>Your goal calories: <strong>${goalCalories}</strong></p>
    `;
    
    // Update macro results
    macroResults.innerHTML = `
        <div class="macro-card">
            <h3>Protein</h3>
            <div class="macro-value">${macros.protein}g</div>
            <p>Builds and repairs muscles</p>
        </div>
        <div class="macro-card">
            <h3>Carbohydrates</h3>
            <div class="macro-value">${macros.carbs}g</div>
            <p>Primary energy source</p>
        </div>
        <div class="macro-card">
            <h3>Fat</h3>
            <div class="macro-value">${macros.fat}g</div>
            <p>Hormone production and energy</p>
        </div>
    `;
    
    // Update meal plan
    let mealPlanHTML = '';
    for (const [meal, details] of Object.entries(mealPlan)) {
        mealPlanHTML += `
            <div class="meal-card">
                <div class="meal-header">${meal.charAt(0).toUpperCase() + meal.slice(1)}</div>
                <div class="meal-content">
                    <p><strong>Macros:</strong> P: ${details.macros.protein}g | C: ${details.macros.carbs}g | F: ${details.macros.fat}g</p>
                    <p><strong>Suggestions:</strong></p>
                    <ul>
                        ${details.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                    </ul>
                    <p><strong>Cooking Tips:</strong></p>
                    <ul>
                        ${details.cookingTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    mealPlanResults.innerHTML = mealPlanHTML;
    
    // Add water intake recommendation
    mealPlanHTML += `
        <div class="meal-card">
            <div class="meal-header">Hydration</div>
            <div class="meal-content">
                <p><strong>Water Intake:</strong> Minimum 3 liters per day</p>
                <p><strong>Tips:</strong></p>
                <ul>
                    <li>Carry a water bottle with you throughout the day</li>
                    <li>Drink 1-2 glasses of water before each meal</li>
                    <li>Add lemon slices or mint leaves for flavor if needed</li>
                </ul>
            </div>
        </div>
    `;
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Form submission handler
document.getElementById('dietForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form values
    const userData = {
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        weight: parseInt(document.getElementById('weight').value),
        height: parseInt(document.getElementById('height').value),
        activity: document.getElementById('activity').value,
        goal: document.getElementById('goal').value,
        dietType: document.querySelector('input[name="dietType"]:checked').value
    };
    
    // Validate inputs
    if (Object.values(userData).some(value => !value || isNaN(value))) {
        alert('Please fill all fields with valid values');
        return;
    }
    
    // Calculate nutrition needs
    const bmr = calculateBMR(userData.weight, userData.height, userData.age, userData.gender);
    const tdee = calculateTDEE(bmr, userData.activity);
    const goalCalories = adjustCaloriesForGoal(tdee, userData.goal);
    const macros = calculateMacros(goalCalories, userData.goal);
    const mealPlan = generateMealPlan(goalCalories, macros, userData.dietType);
    
    // Display results
    displayResults(userData, tdee, goalCalories, macros, mealPlan);
});

// Reset form handler
document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('results').style.display = 'none';
});