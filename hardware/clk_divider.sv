module clk_divider #(
    parameter DIV_WIDTH = 1      
)(
    input  logic clk_in,          
    input  logic rst_n,           
    output logic clk_out         
);

    logic [DIV_WIDTH-1:0] counter;

    always_ff @(posedge clk_in or negedge rst_n) begin
        if (!rst_n) begin
            counter <= 0;
            clk_out <= 0;
        end else begin
            counter <= counter + 1;

            if (counter == (1 << (DIV_WIDTH-1)) - 1) begin
                clk_out <= ~clk_out;
                counter <= 0;
            end
        end
    end

endmodule