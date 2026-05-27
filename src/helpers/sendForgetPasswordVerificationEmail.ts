import { ApiResponse } from "@/types/ApiResponse";


export const sendForgetPasswordVerificationEmail = async (email: string, username: string, verifyCode: string): Promise<ApiResponse> => {
    try {
        // Email service removed intentionally; keep flow non-blocking.
        console.info("Forget-password email sending skipped", { email, username, verifyCode });
        return { success: true, message: "Email service disabled; reset code generated successfully" };
    } catch (error) {
        console.error("Error sending forget password email: ", error);
        return { success: false, message: "Failed to send verification email" }
    }
}