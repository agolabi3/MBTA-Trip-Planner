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
    event.preventDefault();
    const startStopId = document.getElementById('startStop').value;
    const endStopId = document.getElementById('endStop').value;

    // Prevent if the selected start and end stops are the same.
    if (startStopId === endStopId) {
        document.getElementById('result').innerHTML = "You're already at the location you selected!";
        return;
    }

    const startRoutes = stopMap[startStopId].routes; // Routes available from the start stop.
    const endRoutes = stopMap[endStopId].routes; // Routes available from the end stop.

    let routeResults = []; // Store result strings.

    // Check for direct routes between start and end stops.
    const commonRoutes = startRoutes.filter(route => endRoutes.includes(route));
    if (commonRoutes.length > 0) {
        commonRoutes.forEach(route => {
            routeResults.push(`Take the ${route} from ${stopMap[startStopId].name} to ${stopMap[endStopId].name}.`);
        });
    } else {
        // Calculate indirect routes if no direct route is found.
        startRoutes.forEach(startRoute => {
            const startRouteStops = routes.find(r => r.name === startRoute).stops;
            endRoutes.forEach(endRoute => {
                const endRouteStops = routes.find(r => r.name === endRoute).stops;
                const transferStops = [...startRouteStops].filter(stop => endRouteStops.has(stop));
                transferStops.forEach(transferStop => {
                    routeResults.push(`Take the ${startRoute} to ${stopMap[transferStop].name}, then transfer to ${endRoute}.`);
                });
            });
        });

        // Provide a message if no possible routes are found.
        if (routeResults.length === 0) {
            routeResults.push('No route with a simple transfer available.');
        }
    }

    // Join all results with HTML line breaks for browser.
    document.getElementById('result').innerHTML = routeResults.join('<br>');
});


// Call to fetch data and populate dropdowns as soon as the script loads.
fetchAndPopulateData();