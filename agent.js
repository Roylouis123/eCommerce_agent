/**
 * REAL AI AGENT using OpenAI
 * - Autonomous reasoning and planning
 * - Dynamic tool selection
 * - Function calling (tool use)
 * - Self-correction
 * - Natural language understanding
 */

const readline = require("readline");
const dotenv = require("dotenv");
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ Error: OPENAI_API_KEY not found in .env file");
  process.exit(1);
}

/* ===============================
   DATABASE (Knowledge Base)
================================ */
const db = {
  products: [
    { id: "P1001", name: "Wireless Mouse", price: 799, stock: 45, category: "electronics", delivery_days: 2 },
    { id: "P1002", name: "Mechanical Keyboard", price: 2499, stock: 23, category: "electronics", delivery_days: 3 },
    { id: "P1003", name: "USB-C Cable", price: 299, stock: 120, category: "accessories", delivery_days: 1 },
    { id: "P1004", name: "Laptop Stand", price: 1499, stock: 0, category: "accessories", delivery_days: 5 },
    { id: "P1005", name: "Webcam HD", price: 1899, stock: 15, category: "electronics", delivery_days: 2 },
    { id: "P1006", name: "Desk Lamp", price: 999, stock: 30, category: "furniture", delivery_days: 3 }
  ],
  orders: [
    { 
      id: "O9001", 
      customer_id: "C001",
      status: "Delivered", 
      delivery_date: "2025-01-02",
      items: [{ product_id: "P1001", quantity: 1 }],
      total: 799,
      order_date: "2024-12-28"
    },
    { 
      id: "O9002", 
      customer_id: "C001",
      status: "Delayed", 
      delivery_date: "2025-01-05",
      items: [{ product_id: "P1002", quantity: 1 }],
      total: 2499,
      issue: "Warehouse delay",
      order_date: "2024-12-20"
    },
    { 
      id: "O9003", 
      customer_id: "C002",
      status: "Processing", 
      delivery_date: "2025-01-03",
      items: [{ product_id: "P1003", quantity: 2 }],
      total: 598,
      order_date: "2024-12-29"
    }
  ],
  customers: [
    { id: "C001", name: "John Doe", email: "john@example.com", phone: "+91-9876543210" },
    { id: "C002", name: "Jane Smith", email: "jane@example.com", phone: "+91-9876543211" }
  ]
};

/* ===============================
   TOOLS (Functions for AI Agent)
================================ */
const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search for products by name, category, or price range. Returns matching products with stock and delivery information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (product name or category)"
          },
          max_price: {
            type: "number",
            description: "Maximum price filter (optional)"
          },
          min_price: {
            type: "number",
            description: "Minimum price filter (optional)"
          },
          in_stock_only: {
            type: "boolean",
            description: "Filter to only show in-stock items"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Get detailed status of an order including delivery date, items, and any issues.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID (e.g., O9001)"
          }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_delivery_time",
      description: "Check if a product can be delivered by a specific date.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "Product ID to check"
          },
          required_date: {
            type: "string",
            description: "Required delivery date (YYYY-MM-DD)"
          }
        },
        required: ["product_id", "required_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Get complete details of a specific product including price, stock, and specifications.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "Product ID (e.g., P1001)"
          }
        },
        required: ["product_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_total_cost",
      description: "Calculate total cost including shipping for multiple products.",
      parameters: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of product IDs"
          },
          quantities: {
            type: "array",
            items: { type: "number" },
            description: "Quantities for each product"
          }
        },
        required: ["product_ids", "quantities"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_return_eligibility",
      description: "Check if an order is eligible for return based on return policy (30 days).",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "Order ID to check"
          }
        },
        required: ["order_id"]
      }
    }
  }
];

/* ===============================
   TOOL IMPLEMENTATIONS
================================ */
function executeFunction(functionName, args) {
  console.log(`\n🔧 Agent using tool: ${functionName}`);
  console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));

  switch (functionName) {
    case "search_products":
      const query = args.query.toLowerCase();
      let results = db.products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query)
      );

      if (args.max_price) {
        results = results.filter(p => p.price <= args.max_price);
      }
      if (args.min_price) {
        results = results.filter(p => p.price >= args.min_price);
      }
      if (args.in_stock_only) {
        results = results.filter(p => p.stock > 0);
      }

      return {
        success: true,
        products: results.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          category: p.category,
          delivery_days: p.delivery_days,
          available: p.stock > 0
        }))
      };

    case "get_order_status":
      const orderId = args.order_id.toUpperCase();
      const order = db.orders.find(o => o.id === orderId);
      
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      const orderProducts = order.items.map(item => {
        const product = db.products.find(p => p.id === item.product_id);
        return {
          product_name: product?.name,
          quantity: item.quantity
        };
      });

      return {
        success: true,
        order: {
          id: order.id,
          status: order.status,
          delivery_date: order.delivery_date,
          order_date: order.order_date,
          items: orderProducts,
          total: order.total,
          issue: order.issue || null
        }
      };

    case "check_delivery_time":
      const product = db.products.find(p => p.id === args.product_id);
      if (!product) {
        return { success: false, error: "Product not found" };
      }

      const today = new Date();
      const requiredDate = new Date(args.required_date);
      const deliveryDate = new Date(today);
      deliveryDate.setDate(deliveryDate.getDate() + product.delivery_days);

      return {
        success: true,
        can_deliver: deliveryDate <= requiredDate,
        estimated_delivery: deliveryDate.toISOString().split('T')[0],
        days_needed: product.delivery_days,
        product_name: product.name
      };

    case "get_product_details":
      const prod = db.products.find(p => p.id === args.product_id);
      if (!prod) {
        return { success: false, error: "Product not found" };
      }
      return { success: true, product: prod };

    case "calculate_total_cost":
      let total = 0;
      const items = [];
      
      for (let i = 0; i < args.product_ids.length; i++) {
        const prod = db.products.find(p => p.id === args.product_ids[i]);
        if (prod) {
          const qty = args.quantities[i] || 1;
          const itemTotal = prod.price * qty;
          total += itemTotal;
          items.push({
            product: prod.name,
            quantity: qty,
            unit_price: prod.price,
            subtotal: itemTotal
          });
        }
      }

      const shipping = total >= 1000 ? 0 : 50;
      return {
        success: true,
        items,
        subtotal: total,
        shipping,
        total: total + shipping,
        free_shipping: total >= 1000
      };

    case "check_return_eligibility":
      const returnOrder = db.orders.find(o => o.id === args.order_id.toUpperCase());
      if (!returnOrder) {
        return { success: false, error: "Order not found" };
      }

      const orderDate = new Date(returnOrder.order_date);
      const today2 = new Date();
      const daysElapsed = Math.floor((today2 - orderDate) / (1000 * 60 * 60 * 24));
      const eligible = daysElapsed <= 30;

      return {
        success: true,
        eligible,
        days_since_order: daysElapsed,
        days_remaining: eligible ? 30 - daysElapsed : 0,
        order_date: returnOrder.order_date
      };

    default:
      return { success: false, error: "Unknown function" };
  }
}

/* ===============================
   AI AGENT (OpenAI Integration)
================================ */
class AIAgent {
  constructor() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an intelligent e-commerce customer support agent. You have access to tools to help customers.

Your capabilities:
- Search products and check availability
- Track orders and delivery status
- Check delivery times and dates
- Calculate costs with shipping
- Process return requests
- Provide personalized recommendations

Guidelines:
- Be helpful, friendly, and proactive
- Use tools to get accurate information
- Think step-by-step for complex queries
- If you need to use multiple tools, explain your reasoning
- Handle edge cases gracefully
- Provide specific, actionable information
- Show empathy for customer issues

Current date: ${new Date().toISOString().split('T')[0]}`
      }
    ];
  }

  async chat(userMessage) {
    console.log(`\n💭 Agent is thinking...`);
    
    this.conversationHistory.push({
      role: "user",
      content: userMessage
    });

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: this.conversationHistory,
            tools: tools,
            tool_choice: "auto"
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;

        // Add assistant's response to history
        this.conversationHistory.push(message);

        // Check if agent wants to use tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Execute the function
            const result = executeFunction(functionName, functionArgs);

            // Add function result to conversation
            this.conversationHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          }

          // Continue the loop to get final response
          continue;
        }

        // No more tool calls, return the response
        return message.content;

      } catch (error) {
        console.error("\n❌ Error:", error.message);
        return "I apologize, but I encountered an error processing your request. Please try again.";
      }
    }

    return "I apologize, but I've reached my processing limit. Could you please rephrase your question?";
  }

  reset() {
    this.conversationHistory = this.conversationHistory.slice(0, 1); // Keep system message
  }
}

/* ===============================
   TERMINAL INTERFACE
================================ */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const agent = new AIAgent();

console.log("\n🤖 REAL AI AGENT with OpenAI");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Powered by GPT-4 with autonomous reasoning and tool use");
console.log("Type 'exit' to quit, 'reset' to start a new conversation\n");

function chat() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n👋 Thank you for chatting! Have a great day!");
      rl.close();
      return;
    }

    if (input.toLowerCase() === "reset") {
      agent.reset();
      console.log("\n🔄 Conversation reset!\n");
      chat();
      return;
    }

    if (!input.trim()) {
      chat();
      return;
    }

    const reply = await agent.chat(input);
    console.log("\n🤖 Agent:", reply, "\n");
    chat();
  });
}

console.log("💡 Try asking:");
console.log("  - 'I need something under 2000 rupees for my home office that can arrive before January 3rd'");
console.log("  - 'Where is my order O9002?'");
console.log("  - 'Can I return order O9001?'\n");

chat();