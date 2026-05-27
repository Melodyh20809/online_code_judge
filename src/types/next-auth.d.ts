import "next-auth";
import { DefaultSession } from "next-auth";

declare module 'next-auth' {
    interface User {
        id?: string,
        _id?: string,
        username?: string,
        email?: string,
        role?: string,
        empId?: string,
        accessToken?: string,
        expiresIn?: string,
    }

    interface Session {
        user: {
            _id?: string,
            username?: string,
            email?: string,
            role?: string,
            empId?: string,
            accessToken?: string,
            expiresIn?: string,
        } & DefaultSession['user']
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        _id?: string,
        username?: string,
        email?: string,
        role?: string,
        empId?: string,
        accessToken?: string,
        expiresIn?: string,
    }
}
