import recombee from "recombee-api-client"
import { v4 as uuidv4 } from 'uuid';
import { createClient } from "@supabase/supabase-js"
import { RecombeeProduct } from "../types/recombeeproduct.type";

const rqs = recombee.requests;

export class Recombee {
    static client = new recombee.ApiClient("refine-app-prod", process.env.RECOMBEE_PRIVATE_KEY ?? "", {region: "ca-east"})
    static supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    
    static async createOrUpdateProduct(product: RecombeeProduct) {
        let id = product?.itemId
        if (!id) {
            id = uuidv4();
        }
    
        const request = new rqs.SetItemValues(id, 
            {
                supabase_id: product.supabase_id,
                colors: []
            },
            {
                cascadeCreate: true
            }
        );
    
        const res = await this.client.send(request);
        return res
    }
}