import axios from "axios";

const judge0ApiLink = process.env.JUDGE0_BATCH_API_BATCH_LINK || '';

const judge0Headers = {
    "content-type": "application/json",
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    "X-RapidAPI-Key": process.env.JUDGE0_BATCH_API_KEY
};

type TestCase = { input: string; output: string };
type Judge0CreateError = { response?: { data?: { message?: string } } };
type Judge0CreateResponse = { token: string };
type Judge0StatusSubmission = { status: { id: number } };
type Judge0ResultResponse = { submissions: Judge0StatusSubmission[] };

export const runJudge0Batch = async (sourceCode: string, languageId: string, testCases: TestCase[]) => {
    try {
        const submissions = testCases.map((tc) => ({
            source_code: sourceCode,
            language_id: languageId,
            stdin: tc.input,
            expected_output: tc.output,
            base64_encoded: false
        }));

        // Step 1: Create batched submissions
        let submission;
        try {
            submission = await axios.post(
                judge0ApiLink,
                { submissions },
                { headers: judge0Headers }
            );
        } catch (err) {
            const knownErr = err as Judge0CreateError;
            console.error("Failed to create batch submission:", knownErr.response?.data?.message);

            return {
                success: false,
                result: knownErr.response?.data?.message
            }
        }

        const tokens = (submission.data as Judge0CreateResponse[]).map((s) => s.token);

        // Step 2: Fetch batched results
        let results;
        while (true) {
            results = await axios.get(
                `${judge0ApiLink}?tokens=${tokens.join(",")}`,
                { headers: judge0Headers }
            );

            const allDone = (results.data as Judge0ResultResponse).submissions.every(
                (r) => r.status.id > 2 // not "In Queue" or "Processing"
            );

            if (!allDone) {
                await new Promise((r) => setTimeout(r, 1000));
            } else {
                break;
            }
        }

        return {
            success: true,
            result: results.data.submissions
        }
    } catch (error) {
        const knownError = error as Judge0CreateError;
        console.error("Judge0 batch error:", knownError.response?.data);
        return {
            success: false,
            message: knownError.response?.data?.message || "Judge0 API error",
        };
    }
}