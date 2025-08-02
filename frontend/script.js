//When running locally, uncomment the line below and comment out the one below it

//const API_URL = "http://localhost:3000";

//this is to run off of a server, comment out this one when running locally
const API_URL = "https://calorietracker101-1.onrender.com";



const screens = document.querySelectorAll(".screen");
const foodInput = document.getElementById("food");
const intakeInput = document.getElementById("daily-intake");
const goalInput = document.getElementById("goal");
const goalChangeInput = document.getElementById("goal-change");
const enterButton = document.getElementById("submit");
const undoButton = document.getElementById("undo");
const clearButton = document.getElementById("clear");
const enterNewFood = document.getElementById("enter-new-food");
const clearHistoryBtn = document.getElementById("clear-history");

let foods = [];
let totalCalories = 0;
const calorieHistory = [];

//this is the navigation between the screens
function showScreen(screen) {
    // Hide all screens and remove "active" class
    document.querySelectorAll(".screen").forEach(s => {
        s.style.display = "none";
        s.classList.remove("active"); // remove fade class
    });

    // Show selected screen
    const selectedScreen = document.getElementById(`${screen}-screen`);
    selectedScreen.style.display = "block";

    // Add fade-in effect after it's displayed
    setTimeout(() => selectedScreen.classList.add("active"), 10);

    // Show or hide the nav bar dynamically
    const navBar = document.getElementById("main-nav");
    if (screen === "home") {
        navBar.style.display = "none"; // Hide nav on home screen
    } else {
        navBar.style.display = "flex"; // Show nav on other screens
    }

    // Load history dynamically when visiting history screen
    if (screen === "history") {
        loadHistory();
    }
}


//this is the function to change the caloric intake goal in the settings
function changeGoal() {
    const val = parseInt(goalChangeInput.value);
    if (!isNaN(val) && val > 0) {
        goalInput.value = val;
        goalChangeInput.value = "";
        updateStats();
        updateProgressBar();
        showToast(`Goal set to ${val} calories`);
    } else {
        alert("Please enter a valid goal");
    }
}

//function to show the toast messages when the user inputs certain things
function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2000);
}

//gets the foods from the database
async function fetchFoods() {
    const res = await fetch(`${API_URL}/foods`);
    foods = await res.json();
}
//gets the calories of the foods based on their names
function getCaloriesByName(name) {
    const f = foods.find(x => x.name.toLowerCase() === name.toLowerCase());
    return f ? f.calories : null;
}

//loads the foods that are able to use from the user addition, also allows for deletion of foods in list
async function loadFoodsList() {
    const res = await fetch(`${API_URL}/foods`);
    const foodsList = await res.json();
    const container = document.getElementById("foods-list");
    container.innerHTML = foodsList.length === 0 ? "No foods added yet." : "";

    foodsList.forEach(f => {
        const div = document.createElement("div");
        div.className = "food-entry";
        div.innerHTML = `
            ${f.name} - ${f.calories} cal 
            <button class="delete-food" data-id="${f.id}">Delete</button>
        `;
        container.appendChild(div);
    });

    //Attach delete events
    document.querySelectorAll(".delete-food").forEach(button => {
        button.addEventListener("click", async () => {
            if (confirm("Are you sure you want to delete this food?")) {
                await fetch(`${API_URL}/foods/${button.dataset.id}`, { method: "DELETE" });
                await fetchFoods(); 
                loadFoodsList();    
                showToast("Food deleted successfully!");
            }
        });
    });
}


//loads the history of what foods the user has eaten
async function loadHistory() {
    const res = await fetch(`${API_URL}/intake?user_id=1`);
    const history = await res.json();
    const container = document.getElementById("history-list");
    container.innerHTML = "";

    if (history.length === 0) {
        container.textContent = "No food logged yet.";
        return;
    }

    history.forEach(e => {
        const div = document.createElement("div");
        div.className = "history-entry";
        div.textContent = `${e.date}: ${e.food_name} (${e.calories} cal)`;
        container.appendChild(div);
    });
}

//event listener for the enter button
enterButton.addEventListener("click", async () => {
    const name = foodInput.value.trim();
    let cal = getCaloriesByName(name);

    if (cal !== null) {
        // ✅ Local DB food found
        logFood(name, cal);
    } else {
        // ✅ Search Edamam API automatically
        const response = await fetch(`${API_URL}/search-food?query=${encodeURIComponent(name)}`);
        if (response.ok) {
            const data = await response.json();

            // Automatically add to local DB
            await fetch(`${API_URL}/foods`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: data.name, calories: data.calories })
            });

            // Refresh local foods cache
            await fetchFoods();

            // Log the food entry immediately
            logFood(data.name, data.calories);

            showToast(`Added and logged: ${data.name} (${data.calories} cal)`);
        } else {
            alert("Food not found in local DB or Edamam API.");
        }
    }
});

// Helper function to log food
async function logFood(name, cal) {
    totalCalories += cal;
    intakeInput.value = totalCalories;
    calorieHistory.push({ food: name, calories: cal });

    await fetch(`${API_URL}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: 1, food_name: name, calories: cal })
    });

    foodInput.value = "";
    updateProgressBar();
    updateStats();
    loadHistory();
}

foodInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        enterButton.click();
    }
})

//event listener for the undo button
undoButton.addEventListener("click", () => {
    if (calorieHistory.length) {
        const last = calorieHistory.pop();
        totalCalories -= last.calories;
        intakeInput.value = totalCalories;
        showToast(`Removed ${last.food} (${last.calories} cal)`);
    } else {
        alert("No entries to undo.");
    }
    updateProgressBar();
    updateStats();
});

//event listener for the clear button
clearButton.addEventListener("click", () => {
    totalCalories = 0;
    intakeInput.value = 0;
    calorieHistory.length = 0;
    showToast("Daily intake cleared.");
    updateProgressBar();
    updateStats();
});

//event listener for the enter new foods button
enterNewFood.addEventListener("click", async () => {
    const name = document.getElementById("new-food").value.trim();
    const cals = parseInt(document.getElementById("new-calories").value);
    if (name && !isNaN(cals)) {
        const res = await fetch(`${API_URL}/foods`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, calories: cals })
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Error adding food.");
            return;
        }

        showToast(`Added ${name} (${cals} cal)`);
        document.getElementById("new-food").value = "";
        document.getElementById("new-calories").value = "";
        fetchFoods();
        loadFoodsList();
    } else {
        alert("Enter valid food name and calories.");
    }
});

//clears the history with a button from the user intake
clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Clear all history?")) {
        await fetch(`${API_URL}/intake?user_id=1`, { method: "DELETE" });
        loadHistory();
        showToast("History cleared.");
    }
});

//initially sets the user to the home screen when loading up
window.addEventListener("DOMContentLoaded", () => {
    fetchFoods();
    showScreen("home");
});

//dark mode toggle
const darkModeToggle = document.getElementById("dark-mode-toggle");

//load preference on startup
if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    darkModeToggle.checked = true;
}

darkModeToggle.addEventListener("change", () => {
    if (darkModeToggle.checked) { //switching to dark mode based on toggle button
        document.body.classList.add("dark-mode");
        localStorage.setItem("darkMode", "enabled");
    } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("darkMode", "disabled");
    }
});

//updates the progress bar based on the user input for their food
function updateProgressBar() {
    const progressBar = document.getElementById("calorie-progress");
    if (progressBar) {
        progressBar.style.width = `${Math.min((totalCalories / goalInput.value) * 100, 100)}%`;
    }
}

//updates the stats on the home dashboard based of user input of food
function updateStats() {
    const statIntake = document.getElementById("stat-intake");
    const statRemaining = document.getElementById("stat-remaining");
    const statFoods = document.getElementById("stat-foods");

    // Update text content
    statIntake.textContent = totalCalories;
    statRemaining.textContent = Math.max(goalInput.value - totalCalories, 0); // Prevent negative remaining
    statFoods.textContent = calorieHistory.length;
}
