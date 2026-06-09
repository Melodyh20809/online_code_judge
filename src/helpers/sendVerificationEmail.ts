import { ApiResponse } from "@/types/ApiResponse";


export const sendVerificationEmail = async (email: string, username: string, verifyCode: string): Promise<ApiResponse> => {
    try {
        // Email service removed intentionally; keep flow non-blocking.
        console.info("Email sending skipped", { email, username, verifyCode });
        return { success: true, message: "Email service disabled; verification generated successfully" };
    } catch (error) {
        console.error("Error sending verification email: ", error);
        return { success: false, message: "Failed to send verification email" }
    }
}