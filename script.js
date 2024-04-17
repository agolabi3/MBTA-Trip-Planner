//API key - better support for data migration and compatability.
const apiKey = '3f8c96cb6b6f4da29e53764d9b350c01';

// Fetch and analyze subway data, including routes and stops.
async function fetchAndAnalyzeSubwayData() {
    try {
        // Fetch all subway routes using the MBTA API.
        const routeResponse = await fetch(`https://api-v3.mbta.com/routes?filter[type]=0,1&api_key=${apiKey}`);
        // Throw an error if the response is not successful.
        if (!routeResponse.ok) throw new Error(`HTTP error! status: ${routeResponse.status}`);
        const routeData = await routeResponse.json();

        // Exit the function early if no data is returned.
        if (!routeData.data) {
            console.error('No route data available:', routeData);
            return;
        }

        // Transform each route in the API response to include only relevant data and a set to store stops.
        const routes = routeData.data.map(route => ({
            id: route.id,
            name: route.attributes.long_name,
            stops: new Set()
        }));

        // Iterate over each route to fetch stops.
        for (const route of routes) {
            const stopsResponse = await fetch(`https://api-v3.mbta.com/stops?filter[route]=${route.id}&api_key=${apiKey}`);
            const stopsData = await stopsResponse.json();
            // Add each stop to the route's set of stops if stops data is available.
            if (stopsData.data) {
                stopsData.data.forEach(stop => route.stops.add(stop.id));
            }
        }

        // Initialize variables to track the route with the most and fewest stops.
        let mostStops = { count: 0, name: '' };
        let fewestStops = { count: Infinity, name: '' };
        // Analyze routes to find the ones with the most and fewest stops.
        routes.forEach(route => {
            const count = route.stops.size;
            if (count > mostStops.count) {
                mostStops = { count, name: route.name };
            }
            if (count < fewestStops.count && count > 0) { // Ensure the route has at least one stop.
                fewestStops = { count, name: route.name };
            }
        });

        // Log routes with the most and fewest stops.
        console.log(`Route with most stops: ${mostStops.name} (${mostStops.count} stops)`);
        console.log(`Route with fewest stops: ${fewestStops.name} (${fewestStops.count} stops)`);

        // Create a map of stops to the routes they are on.
        const stopMap = {};
        routes.forEach(route => {
            route.stops.forEach(stop => {
                if (!stopMap[stop]) {
                    stopMap[stop] = [];
                }
                stopMap[stop].push(route.name);
            });
        });

        // Identify and log stops that are shared by multiple routes.
        const sharedStops = Object.keys(stopMap).filter(stop => stopMap[stop].length > 1);
        console.log("Shared Stops:");
        sharedStops.forEach(stop => {
            console.log(`${stop}: ${stopMap[stop].join(", ")}`);
        });

    } catch (error) {
        console.error("Failed to fetch subway data:", error);
    }
}

// Fetch and analyze subway data upon script execution.
fetchAndAnalyzeSubwayData();


const routes = [];
const stopMap = {};

// Fetch route and stop data from the MBTA API and populate dropdowns for user selection.
async function fetchAndPopulateData() {
    try {
        // Fetch data about all subway routes filtering by types 0 and 1, which represent subway services.
        const routeResponse = await fetch(`https://api-v3.mbta.com/routes?filter[type]=0,1&api_key=${apiKey}`);
        const routeData = await routeResponse.json();
        // Iterate over each route to store its details and prepare for fetching stops.
        routeData.data.forEach(route => {
            routes.push({
                id: route.id,
                name: route.attributes.long_name,
                stops: new Set()  // Set to ensure unique stops per route.
            });
        });

        // Fetch and store stop data for each route.
        for (const route of routes) {
            const stopsResponse = await fetch(`https://api-v3.mbta.com/stops?filter[route]=${route.id}&api_key=${apiKey}`);
            const stopsData = await stopsResponse.json();
            stopsData.data.forEach(stop => {
                route.stops.add(stop.id);
                // Update the stopMap to include the stop name and associated routes.
                stopMap[stop.id] = stopMap[stop.id] || { routes: [], name: stop.attributes.name };
                stopMap[stop.id].routes.push(route.name);
                // Populate dropdown menus if the stop is not already included.
                if (!document.querySelector(`#startStop option[value="${stop.id}"]`)) {
                    document.querySelector('#startStop').innerHTML += `<option value="${stop.id}">${stop.attributes.name}</option>`;
                    document.querySelector('#endStop').innerHTML += `<option value="${stop.id}">${stop.attributes.name}</option>`;
                }
            });
        }
    } catch (error) {
        console.error("Failed to fetch subway data:", error);
    }
}

// Listen for form submission to calculate and display the route or required connections.
document.getElementById('routeForm').addEventListener('submit', function(event) {
    event.preventDefault();  // Prevent the default form submission behavior.
    const startStop = document.getElementById('startStop').value;
    const endStop = document.getElementById('endStop').value;

    // Check if the start and end stops are the same and notify the user.
    if (startStop === endStop) {
        document.getElementById('result').textContent = "You're already at the location you selected!";
        return;  // Exit the function early to avoid unnecessary processing.
    }

    const startRoutes = stopMap[startStop].routes;
    const endRoutes = stopMap[endStop].routes;

    // Initialize the output message for no route found by default.
    let resultText = 'No direct route or connection available.';
    // Check if any route exists directly between the selected stops.
    if (startRoutes.some(r => endRoutes.includes(r))) {
        // Find the common route and construct the result text using the full stop names.
        const commonRoute = startRoutes.find(r => endRoutes.includes(r));
        resultText = `Take the ${commonRoute} from ${stopMap[startStop].name} to ${stopMap[endStop].name}.`;
    } else {
        // If no direct route, give possible connections and format the result text.
        const possibleConnections = startRoutes.flatMap(r1 => endRoutes.map(r2 => ({ from: r1, to: r2 })));
        resultText = 'Connections required: ' + possibleConnections.map(conn => `${conn.from} to ${conn.to}`).join(', ');
    }
    document.getElementById('result').textContent = resultText;  // Display the result in the 'result' div.
});

// Call to fetch data and populate dropdowns as soon as the script loads.
fetchAndPopulateData();