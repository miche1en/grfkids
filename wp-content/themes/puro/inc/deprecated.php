<?php
/**
 * Deprecated functions.
 *
 * @package puro
 * @since puro 1.1.5
 * @license GPL 2.0
 */

if ( ! function_exists( 'puro_pagination' ) ) :
/**
 * Display post pagination where applicable.
 * @deprecated 1.1.5 Use the_posts_pagination()
 */
function puro_pagination() {
	// Don't print empty markup if there's only one page.
	if ( $GLOBALS['wp_query']->max_num_pages < 2 ) {
		return;
	}
	?>
		<nav class="navigation paging-navigation" role="navigation">
			<h1 class="screen-reader-text"><?php esc_html_e( 'Posts navigation', 'puro' ); ?></h1>
			<?php if ( function_exists( 'wp_pagenavi' ) ) : ?>
				<?php wp_pagenavi(); ?>
			<?php else : ?>			
			<div class="nav-links">
			<?php
			global $wp_query;

			$total = $wp_query->max_num_pages;

			echo paginate_links( array(
				'base' => str_replace( $total, '%#%', esc_url( get_pagenum_link( $total ) ) ),
				'format' => '?paged=%#%',
				'current' => max( 1, get_query_var( 'paged' ) ),
				'total' => $total,
				'prev_text' => esc_html__( 'Previous', 'puro' ),
				'next_text' => esc_html__( 'Next', 'puro' ),
			) );
			?>
			</div><!-- .nav-links -->
			<?php endif; ?>
		</nav><!-- .navigation -->
	<?php
}
endif;
