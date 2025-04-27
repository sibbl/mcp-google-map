#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DIRECTIONS_TOOL, DISTANCE_MATRIX_TOOL, ELEVATION_TOOL, GEOCODE_TOOL, GET_PLACE_DETAILS_TOOL, REVERSE_GEOCODE_TOOL, SEARCH_NEARBY_TOOL } from "./maps-tools/mapsTools.js";
import { PlacesSearcher } from "./maps-tools/searchPlaces.js";

const tools = [SEARCH_NEARBY_TOOL, GET_PLACE_DETAILS_TOOL, GEOCODE_TOOL, REVERSE_GEOCODE_TOOL, DISTANCE_MATRIX_TOOL, DIRECTIONS_TOOL, ELEVATION_TOOL];
const placesSearcher = new PlacesSearcher();

const server = new Server(
  {
    name: "mcp-server/maps_executor",
    version: "0.0.1",
  },
  {
    capabilities: {
      description: "An MCP server providing Google Maps integration",
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) throw new Error("No parameters provided");

    if (name === "search_nearby") {
      const { center, keyword, radius, openNow, minRating } = args as {
        center: { value: string; isCoordinates: boolean };
        keyword?: string;
        radius?: number;
        openNow?: boolean;
        minRating?: number;
      };

      const result = await placesSearcher.searchNearby({ center, keyword, radius, openNow, minRating });

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Search failed" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `location: ${JSON.stringify(result.location, null, 2)}\n${JSON.stringify(result.data, null, 2)}`,
          },
        ],
        isError: false,
      };
    }

    if (name === "get_place_details") {
      const { placeId } = args as { placeId: string };

      const result = await placesSearcher.getPlaceDetails(placeId);

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Failed to fetch place details" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    if (name === "maps_geocode") {
      const { address } = args as { address: string };

      const result = await placesSearcher.geocode(address);

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Geocoding failed" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    if (name === "maps_reverse_geocode") {
      const { latitude, longitude } = args as { latitude: number; longitude: number };

      const result = await placesSearcher.reverseGeocode(latitude, longitude);

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Reverse geocoding failed" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    if (name === "maps_distance_matrix") {
      const { origins, destinations, mode } = args as {
        origins: string[];
        destinations: string[];
        mode?: "driving" | "walking" | "bicycling" | "transit";
      };

      const result = await placesSearcher.calculateDistanceMatrix(origins, destinations, mode || "driving");

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Distance matrix calculation failed" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    if (name === "maps_directions") {
      const { origin, destination, mode } = args as {
        origin: string;
        destination: string;
        mode?: "driving" | "walking" | "bicycling" | "transit";
      };

      const result = await placesSearcher.getDirections(origin, destination, mode || "driving");

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Fetching directions failed" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    if (name === "maps_elevation") {
      const { locations } = args as { locations: Array<{ latitude: number; longitude: number }> };

      const result = await placesSearcher.getElevation(locations);

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "Elevation data fetching failed" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: false,
      };
    }

    return {
      content: [{ type: "text", text: `Error: Unknown tool '${name}'` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Maps Server started");
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Server encountered a critical error:", error);
  process.exit(1);
});