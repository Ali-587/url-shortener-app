import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.TABLE_NAME;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
    },
    body: JSON.stringify(body)
  };
}

function redirectResponse(location) {
  return {
    statusCode: 301,
    headers: {
      Location: location,
      "Access-Control-Allow-Origin": "*"
    },
    body: ""
  };
}

function isValidUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function generateShortCode(length = 7) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function getRequestInfo(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";

  let path = event.rawPath || event.path || "/";

  /*
    CloudFront sends API requests as:
    /api/shorten
    /api/abc123

    The app logic expects:
    /shorten
    /abc123

    So we remove the /api prefix.
  */
  path = path.replace(/^\/api/, "");

  if (path === "") {
    path = "/";
  }

  return {
    method,
    path
  };
}

function getCloudFrontBaseUrl(event) {
  /*
    When request comes through CloudFront, the Host header is the CloudFront domain.
    Example:
    d123456abcdef.cloudfront.net

    We use it to generate short URLs like:
    https://d123456abcdef.cloudfront.net/api/abc123
  */

  const headers = event.headers || {};
  const host = headers.host || headers.Host;

  if (host) {
    return `https://${host}`;
  }

  const domainName = event.requestContext?.domainName;

  if (domainName) {
    return `https://${domainName}`;
  }

  return "";
}

async function shortenUrl(event) {
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      message: "Invalid JSON body"
    });
  }

  const originalUrl = body.url;

  if (!originalUrl) {
    return jsonResponse(400, {
      message: "Missing required field: url"
    });
  }

  if (!isValidUrl(originalUrl)) {
    return jsonResponse(400, {
      message: "Invalid URL. URL must start with http:// or https://"
    });
  }

  const shortCode = body.customCode || generateShortCode();

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(shortCode)) {
    return jsonResponse(400, {
      message:
        "Short code must be 3-30 characters and contain only letters, numbers, hyphen or underscore"
    });
  }

  const createdAt = new Date().toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          shortCode,
          originalUrl,
          createdAt,
          clicks: 0
        },
        ConditionExpression: "attribute_not_exists(shortCode)"
      })
    );
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return jsonResponse(409, {
        message: "Short code already exists. Try another one."
      });
    }

    throw error;
  }

  const publicBaseUrl = getCloudFrontBaseUrl(event);

  const shortUrl = publicBaseUrl
    ? `${publicBaseUrl}/api/${shortCode}`
    : `/api/${shortCode}`;

  return jsonResponse(201, {
    message: "Short URL created successfully",
    shortCode,
    originalUrl,
    shortUrl,
    createdAt
  });
}

async function redirectToOriginalUrl(event, path) {
  const shortCode = path.replace("/", "");

  if (!shortCode) {
    return jsonResponse(400, {
      message: "Missing short code"
    });
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        shortCode
      }
    })
  );

  if (!result.Item) {
    return jsonResponse(404, {
      message: "Short URL not found"
    });
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        shortCode
      },
      UpdateExpression: "SET clicks = if_not_exists(clicks, :zero) + :inc",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1
      }
    })
  );

  return redirectResponse(result.Item.originalUrl);
}

async function healthCheck() {
  return jsonResponse(200, {
    message: "URL shortener backend is running"
  });
}

export const handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));

  try {
    const { method, path } = getRequestInfo(event);

    if (method === "OPTIONS") {
      return jsonResponse(200, {
        message: "CORS preflight successful"
      });
    }

    if (method === "GET" && path === "/health") {
      return healthCheck();
    }

    if (method === "POST" && path === "/shorten") {
      return shortenUrl(event);
    }

    if (method === "GET" && path !== "/") {
      return redirectToOriginalUrl(event, path);
    }

    if (method === "GET" && path === "/") {
      return healthCheck();
    }

    return jsonResponse(404, {
      message: "Route not found",
      method,
      path,
      availableRoutes: [
        "GET /api/health",
        "POST /api/shorten",
        "GET /api/{shortCode}"
      ]
    });
  } catch (error) {
    console.error("Application error:", error);

    return jsonResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};