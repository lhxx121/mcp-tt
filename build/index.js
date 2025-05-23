// 环境信息输出（调试用）
console.error('--------- 环境信息 ---------');
console.error(`Node.js版本: ${process.version}`);
console.error(`进程ID: ${process.pid}`);
console.error(`平台: ${process.platform}`);
console.error(`工作目录: ${process.cwd()}`);
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generatePeppaImage } from "./client.js";
import fetch from "node-fetch";
// 辅助函数：将图像URL转换为base64
async function imageUrlToBase64(url) {
    try {
        // 如果已经是data URI，直接提取base64部分
        if (url.startsWith('data:')) {
            return url.split(',')[1];
        }
        // 否则获取图像并转换
        const response = await fetch(url);
        const buffer = await response.buffer();
        return buffer.toString('base64');
    }
    catch (error) {
        console.error(`Error converting image to base64: ${error}`);
        return '';
    }
}
// 创建 MCP Server 实例
const server = new McpServer({
    name: "peppa_image_generator",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
// 注册图像生成工具
server.registerTool("generate-image", {
    description: "根据用户输入生成一张图片（如小猪佩奇）",
    inputSchema: {
        prompt: z.string().max(100).describe("描述图像内容的提示词"),
    },
    outputSchema: {
        content: z.array(z.union([
            z.object({
                type: z.literal("text"),
                text: z.string(),
            }),
            z.object({
                type: z.literal("image"),
                data: z.string().url(),
                mimeType: z.string(),
            }),
        ])),
    }
}, async ({ prompt }, extra) => {
    const images = await generatePeppaImage(prompt);
    if (!images.length) {
        return {
            content: [
                {
                    type: "text",
                    text: "图像生成失败或无结果",
                },
            ],
            structuredContent: { images: [] }
        };
    }
    // 处理所有图像URL
    const processedImages = await Promise.all(images.map(async (url) => {
        if (url.startsWith('data:')) {
            return url.split(',')[1];
        }
        else {
            return await imageUrlToBase64(url);
        }
    }));
    return {
        content: [
            {
                type: "text",
                text: `为 "${prompt}" 生成了以下图像：`,
            },
            ...processedImages.map((data) => ({
                type: "image",
                data,
                mimeType: "image/png",
            })),
        ],
        structuredContent: { images: processedImages }
    };
});
// 启动 MCP 服务
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Peppa Image MCP Server running via stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
